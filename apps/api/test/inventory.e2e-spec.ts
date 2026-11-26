import type { INestApplication } from '@nestjs/common';
import { agentFor, createApp, createLens, unique, withDb } from './helpers.js';

type Agent = Awaited<ReturnType<typeof agentFor>>;

describe('lenses, imports, HU06 and HU11 (e2e)', () => {
  let app: INestApplication;
  let jefe: Agent;
  let auxiliar: Agent;
  let director: Agent;

  beforeAll(async () => {
    app = await createApp();
    jefe = await agentFor(app, 'jefe_almacen');
    auxiliar = await agentFor(app, 'auxiliar_bodega');
    director = await agentFor(app, 'director_tecnico');
  });
  afterAll(() => app.close());

  const lotLine = (
    lensId: string,
    overrides: Record<string, unknown> = {},
  ) => ({
    lensId,
    lotNumber: unique('LOT'),
    invimaRegistration: 'INVIMA 2024DM-0001234',
    boxCount: 2,
    quantity: 50,
    ...overrides,
  });

  const registerImport = async (
    lots: Record<string, unknown>[],
    agent: Agent = jefe,
  ) =>
    agent
      .post('/api/imports')
      .send({
        distributor: 'Distribuidor SA',
        invoiceNumber: 'F-100',
        manufacturer: 'Optica Co',
        lots,
      });

  describe('product register (lenses)', () => {
    it('creates a lens and rejects a duplicate code', async () => {
      const lens = await createLens(jefe);
      const dup = await jefe
        .post('/api/lenses')
        .send({ code: lens.code, description: 'x', sphere: 0, cylinder: 0 })
        .expect(409);
      expect(dup.body.errors.code).toBeDefined();
    });

    it('enforces the formula rules from some_info.md', async () => {
      const bad = async (sphere: number, cylinder: number) =>
        (
          await jefe
            .post('/api/lenses')
            .send({ code: unique('BAD'), description: 'x', sphere, cylinder })
            .expect(400)
        ).body.errors;

      expect(await bad(4.25, 0)).toHaveProperty('sphere');
      expect(await bad(-4.25, 0)).toHaveProperty('sphere');
      expect(await bad(1.1, 0)).toHaveProperty('sphere'); // not a 0.25 step
      expect(await bad(0, 0.25)).toHaveProperty('cylinder'); // cylinder is never positive
      expect(await bad(0, -4.25)).toHaveProperty('cylinder');
      expect(await bad(0, -0.3)).toHaveProperty('cylinder');
    });

    it('accepts the boundary values', async () => {
      await createLens(jefe, { sphere: 4, cylinder: -4 });
      await createLens(jefe, { sphere: -4, cylinder: 0 });
      await createLens(jefe, { sphere: 0.25, cylinder: -0.25 });
    });

    it('only the jefe de almacén can create or edit; other warehouse roles can read', async () => {
      const body = {
        code: unique('X'),
        description: 'x',
        sphere: 0,
        cylinder: 0,
      };
      await auxiliar.post('/api/lenses').send(body).expect(403);
      await director.post('/api/lenses').send(body).expect(403);
      await auxiliar.get('/api/lenses').expect(200);
    });

    it('updates description and minimum stock but not the formula', async () => {
      const lens = await createLens(jefe);
      const res = await jefe
        .patch(`/api/lenses/${lens.id}`)
        .send({ minStock: 12, description: 'Nueva descripción', sphere: 3 })
        .expect(200);
      expect(res.body).toMatchObject({
        minStock: 12,
        description: 'Nueva descripción',
        sphere: -1.5,
      });
      await jefe.patch(`/api/lenses/${lens.id}`).send({}).expect(400);
    });

    it('updating only the description keeps the minimum stock', async () => {
      const lens = await createLens(jefe, { minStock: 9 });
      const res = await jefe
        .patch(`/api/lenses/${lens.id}`)
        .send({ description: 'Solo texto' })
        .expect(200);
      expect(res.body).toMatchObject({
        minStock: 9,
        description: 'Solo texto',
      });
    });

    it('searches by code or description, treating % and _ literally', async () => {
      const lens = await createLens(jefe, {
        description: 'Progresivo 100%_azul',
      });
      const hit = await jefe
        .get('/api/lenses')
        .query({ q: '100%_azul' })
        .expect(200);
      expect(hit.body.map((l: { id: string }) => l.id)).toContain(lens.id);
      const wild = await jefe.get('/api/lenses').query({ q: '%' }).expect(200);
      expect(wild.body.map((l: { id: string }) => l.id)).toContain(lens.id); // contains a literal %
      const none = await jefe
        .get('/api/lenses')
        .query({ q: 'zzz-no-match' })
        .expect(200);
      expect(none.body).toEqual([]);
    });
  });

  describe('import registration', () => {
    it('creates the import with one pending lot per line, stock and a reception event', async () => {
      const a = await createLens(jefe);
      const b = await createLens(jefe);
      const res = await registerImport([
        lotLine(a.id, { quantity: 30 }),
        lotLine(b.id, { quantity: 20, qualityNotes: 'Caja golpeada' }),
      ]).then((r) => {
        expect(r.status).toBe(201);
        return r.body;
      });
      expect(res).toMatchObject({
        distributor: 'Distribuidor SA',
        lotCount: 2,
        totalUnits: 50,
      });
      expect(
        res.lots.every(
          (l: { status: string }) => l.status === 'pendiente_revision',
        ),
      ).toBe(true);
      expect(
        res.lots.map((l: { quantity: number }) => l.quantity).sort(),
      ).toEqual([20, 30]);

      const events = await withDb((db) =>
        db.query(
          `SELECT event_type, count(*)::int AS n FROM lot_events
           WHERE lot_id = ANY($1) GROUP BY event_type`,
          [res.lots.map((l: { id: string }) => l.id)],
        ),
      );
      expect(events.rows).toEqual([{ event_type: 'recepcion', n: 2 }]);
    });

    it('is atomic: a duplicate lot number rolls back the whole import', async () => {
      const lens = await createLens(jefe);
      const taken = unique('TAKEN');
      await registerImport([lotLine(lens.id, { lotNumber: taken })]).then((r) =>
        expect(r.status).toBe(201),
      );

      const before = await withDb((db) =>
        db.query('SELECT count(*)::int AS n FROM imports'),
      );
      const res = await registerImport([
        lotLine(lens.id),
        lotLine(lens.id, { lotNumber: taken }),
      ]);
      expect(res.status).toBe(409);
      expect(res.body.errors).toHaveProperty('lots.1.lotNumber');
      const after = await withDb((db) =>
        db.query('SELECT count(*)::int AS n FROM imports'),
      );
      expect(after.rows[0].n).toBe(before.rows[0].n);
    });

    it('validates required fields and numeric ranges with per-field messages', async () => {
      const lens = await createLens(jefe);
      const res = await jefe
        .post('/api/imports')
        .send({
          distributor: '',
          lots: [
            lotLine(lens.id, {
              boxCount: 0,
              quantity: 1.5,
              invimaRegistration: '',
            }),
          ],
        })
        .expect(400);
      expect(Object.keys(res.body.errors).sort()).toEqual([
        'distributor',
        'lots.0.boxCount',
        'lots.0.invimaRegistration',
        'lots.0.quantity',
      ]);
      await jefe
        .post('/api/imports')
        .send({ distributor: 'X', lots: [] })
        .expect(400);
    });

    it('rejects the same lot number twice in one import, ignoring case', async () => {
      const lens = await createLens(jefe);
      const dup = unique('DUP');
      const res = await jefe
        .post('/api/imports')
        .send({
          distributor: 'X',
          lots: [
            lotLine(lens.id, { lotNumber: dup }),
            lotLine(lens.id, { lotNumber: dup.toLowerCase() }),
          ],
        })
        .expect(400);
      expect(res.body.errors).toHaveProperty('lots.1.lotNumber');
    });

    it('rejects an unknown lens reference without creating anything', async () => {
      const before = await withDb((db) =>
        db.query('SELECT count(*)::int AS n FROM imports'),
      );
      const res = await registerImport([
        lotLine('00000000-0000-4000-8000-000000000000'),
      ]);
      expect(res.status).toBe(400);
      const after = await withDb((db) =>
        db.query('SELECT count(*)::int AS n FROM imports'),
      );
      expect(after.rows[0].n).toBe(before.rows[0].n);
    });

    it('auxiliar can register; director and anonymous cannot', async () => {
      const lens = await createLens(jefe);
      await registerImport([lotLine(lens.id)], auxiliar).then((r) =>
        expect(r.status).toBe(201),
      );
      await registerImport([lotLine(lens.id)], director).then((r) =>
        expect(r.status).toBe(403),
      );
    });

    it('records the location and a ubicacion event, and can assign one later', async () => {
      const lens = await createLens(jefe);
      const loc = (
        await jefe
          .post('/api/locations')
          .send({ code: unique('A-01') })
          .expect(201)
      ).body;
      await jefe.post('/api/locations').send({ code: loc.code }).expect(409);

      const created = (
        await registerImport([
          lotLine(lens.id, { locationId: loc.id }),
          lotLine(lens.id),
        ])
      ).body;
      const [withLoc, withoutLoc] = [
        created.lots.find((l: { locationId: string | null }) => l.locationId),
        created.lots.find((l: { locationId: string | null }) => !l.locationId),
      ];
      expect(withLoc.locationCode).toBe(loc.code);

      const moved = await auxiliar
        .patch(`/api/lots/${withoutLoc.id}/location`)
        .send({ locationId: loc.id })
        .expect(200);
      expect(moved.body.locationCode).toBe(loc.code);
      await auxiliar
        .patch(`/api/lots/${withoutLoc.id}/location`)
        .send({ locationId: '00000000-0000-4000-8000-000000000000' })
        .expect(404);
    });
  });

  describe('HU06: authorize lots', () => {
    const pendingLot = async () => {
      const lens = await createLens(jefe);
      const res = await registerImport([lotLine(lens.id, { quantity: 40 })]);
      return {
        lens,
        lot: res.body.lots[0] as { id: string; lotNumber: string },
      };
    };

    it('1) lists only pending lots with the fields the story asks for', async () => {
      const { lot } = await pendingLot();
      const approved = await pendingLot();
      await director.post(`/api/lots/${approved.lot.id}/approve`).expect(200);
      const rejected = await pendingLot();
      await director
        .post(`/api/lots/${rejected.lot.id}/reject`)
        .send({ reason: 'Defectos' })
        .expect(200);

      const res = await director
        .get('/api/lots')
        .query({ status: 'pendiente_revision' })
        .expect(200);
      const ids = res.body.map((l: { id: string }) => l.id);
      expect(ids).toContain(lot.id);
      expect(ids).not.toContain(approved.lot.id);
      expect(ids).not.toContain(rejected.lot.id);
      expect(
        res.body.every(
          (l: { status: string }) => l.status === 'pendiente_revision',
        ),
      ).toBe(true);

      const row = res.body.find((l: { id: string }) => l.id === lot.id);
      expect(row).toMatchObject({
        lotNumber: lot.lotNumber,
        distributor: 'Distribuidor SA',
        quantity: 40,
      });
      expect(row.receivedAt).toBeTruthy();
      expect(row.lensCode).toBeTruthy();
    });

    it('2) approving sets Autorizado and records who, when, and a history event', async () => {
      const { lot } = await pendingLot();
      const res = await director
        .post(`/api/lots/${lot.id}/approve`)
        .expect(200);
      expect(res.body.status).toBe('autorizado');
      expect(res.body.decidedByName).toBe('Test director_tecnico');
      expect(Date.now() - new Date(res.body.decidedAt).getTime()).toBeLessThan(
        60_000,
      );

      const events = await withDb((db) =>
        db.query(
          'SELECT event_type FROM lot_events WHERE lot_id = $1 ORDER BY occurred_at, event_type',
          [lot.id],
        ),
      );
      expect(events.rows.map((r) => r.event_type)).toContain('autorizacion');
    });

    it('3) rejecting requires a reason; with one the lot is Rechazado', async () => {
      const { lot } = await pendingLot();
      const noReason = await director
        .post(`/api/lots/${lot.id}/reject`)
        .send({})
        .expect(400);
      expect(noReason.body.errors).toHaveProperty('reason');
      await director
        .post(`/api/lots/${lot.id}/reject`)
        .send({ reason: '   ' })
        .expect(400);
      expect(
        (
          await director
            .get(`/api/lots`)
            .query({ status: 'pendiente_revision', q: lot.lotNumber })
        ).body,
      ).toHaveLength(1);

      const res = await director
        .post(`/api/lots/${lot.id}/reject`)
        .send({ reason: 'Lentes con defectos' })
        .expect(200);
      expect(res.body).toMatchObject({
        status: 'rechazado',
        rejectionReason: 'Lentes con defectos',
      });
    });

    it('a lot can be decided only once', async () => {
      const { lot } = await pendingLot();
      await director.post(`/api/lots/${lot.id}/approve`).expect(200);
      await director.post(`/api/lots/${lot.id}/approve`).expect(409);
      await director
        .post(`/api/lots/${lot.id}/reject`)
        .send({ reason: 'Tarde' })
        .expect(409);
    });

    it('two simultaneous decisions: exactly one wins', async () => {
      const { lot } = await pendingLot();
      const other = await agentFor(app, 'director_tecnico');
      const results = await Promise.all([
        director.post(`/api/lots/${lot.id}/approve`),
        other.post(`/api/lots/${lot.id}/reject`).send({ reason: 'Defecto' }),
      ]);
      expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([200, 409]);
    });

    it('only the director técnico (or admin) decides; unknown lot is 404', async () => {
      const { lot } = await pendingLot();
      await jefe.post(`/api/lots/${lot.id}/approve`).expect(403);
      await auxiliar
        .post(`/api/lots/${lot.id}/reject`)
        .send({ reason: 'x' })
        .expect(403);
      await director
        .post('/api/lots/00000000-0000-4000-8000-000000000000/approve')
        .expect(404);
      await director.post('/api/lots/not-a-uuid/approve').expect(400);
    });
  });

  describe('HU11: inventory and alerts', () => {
    const stockLot = async (
      lensId: string,
      quantity: number,
      approve = true,
    ) => {
      const res = await registerImport([lotLine(lensId, { quantity })]);
      const lot = res.body.lots[0];
      if (approve)
        await director.post(`/api/lots/${lot.id}/approve`).expect(200);
      return lot as { id: string; lotNumber: string };
    };
    const reference = async (lensId: string) =>
      (await jefe.get('/api/inventory/references').expect(200)).body.find(
        (r: { lensId: string }) => r.lensId === lensId,
      );

    it('1) lists lots with reference, quantity, location and status; filters by lot or reference', async () => {
      const lens = await createLens(jefe);
      const loc = (
        await jefe
          .post('/api/locations')
          .send({ code: unique('B-02') })
          .expect(201)
      ).body;
      const res = await registerImport([
        lotLine(lens.id, { quantity: 25, locationId: loc.id }),
      ]);
      const lot = res.body.lots[0];
      await director.post(`/api/lots/${lot.id}/approve`).expect(200);

      const byLot = (
        await jefe.get('/api/lots').query({ q: lot.lotNumber }).expect(200)
      ).body;
      expect(byLot).toHaveLength(1);
      expect(byLot[0]).toMatchObject({
        lensCode: lens.code,
        quantity: 25,
        locationCode: loc.code,
        status: 'autorizado',
      });
      const byLens = (
        await jefe.get('/api/lots').query({ lensId: lens.id }).expect(200)
      ).body;
      expect(byLens.map((l: { id: string }) => l.id)).toEqual([lot.id]);
      const byCode = (
        await jefe.get('/api/lots').query({ q: lens.code }).expect(200)
      ).body;
      expect(byCode).toHaveLength(1);
    });

    it('counts only authorized stock as available; quarantined units are reported separately', async () => {
      const lens = await createLens(jefe, { minStock: 5 });
      await stockLot(lens.id, 100); // authorized
      await stockLot(lens.id, 30, false); // still pending
      const lot3 = await stockLot(lens.id, 7, false);
      await director
        .post(`/api/lots/${lot3.id}/reject`)
        .send({ reason: 'Defecto' })
        .expect(200); // rejected

      expect(await reference(lens.id)).toMatchObject({
        available: 100,
        quarantine: 30,
        state: 'ok',
      });
    });

    it('2) low-stock alert triggers at or below the minimum', async () => {
      const atMin = await createLens(jefe, { minStock: 10 });
      await stockLot(atMin.id, 10);
      expect(await reference(atMin.id)).toMatchObject({
        available: 10,
        minStock: 10,
        state: 'bajo',
      });

      const below = await createLens(jefe, { minStock: 10 });
      await stockLot(below.id, 3);
      expect(await reference(below.id)).toMatchObject({
        available: 3,
        state: 'bajo',
      });

      const above = await createLens(jefe, { minStock: 10 });
      await stockLot(above.id, 11);
      expect(await reference(above.id)).toMatchObject({
        available: 11,
        state: 'ok',
      });

      const lows = (
        await jefe
          .get('/api/inventory/references')
          .query({ state: 'bajo' })
          .expect(200)
      ).body;
      const ids = lows.map((r: { lensId: string }) => r.lensId);
      expect(ids).toEqual(expect.arrayContaining([atMin.id, below.id]));
      expect(ids).not.toContain(above.id);
    });

    it('3) a reference with no stock shows quantity 0 and is Agotada, not omitted', async () => {
      const never = await createLens(jefe, { minStock: 4 });
      expect(await reference(never.id)).toMatchObject({
        available: 0,
        state: 'agotada',
      });

      const onlyPending = await createLens(jefe);
      await stockLot(onlyPending.id, 50, false);
      expect(await reference(onlyPending.id)).toMatchObject({
        available: 0,
        quarantine: 50,
        state: 'agotada',
      });
    });

    it('a new reference with min stock 0 is agotada, and stays ok once stocked', async () => {
      const lens = await createLens(jefe, { minStock: 0 });
      expect((await reference(lens.id)).state).toBe('agotada');
      await stockLot(lens.id, 1);
      expect((await reference(lens.id)).state).toBe('ok');
    });

    it('searches references and is restricted to warehouse roles and the director', async () => {
      const lens = await createLens(jefe);
      const hit = (
        await jefe
          .get('/api/inventory/references')
          .query({ q: lens.code })
          .expect(200)
      ).body;
      expect(hit).toHaveLength(1);
      const pos = await agentFor(app, 'asesor_punto_venta');
      await pos.get('/api/inventory/references').expect(403);
      await pos.get('/api/lots').expect(403);
    });
  });
});
