import { BrowserRouter, Route, Routes } from "react-router";
import { AuthProvider } from "./auth/AuthContext";
import { RequireAuth, RequireRole } from "./auth/guards";
import { Layout } from "./components/Layout";
import { ACCESS } from "./lib/roles";
import { AuthorizePage } from "./pages/AuthorizePage";
import { HomePage } from "./pages/HomePage";
import { ImportsPage } from "./pages/ImportsPage";
import { InventoryPage } from "./pages/InventoryPage";
import { LensesPage } from "./pages/LensesPage";
import { LoginPage } from "./pages/LoginPage";
import { NewImportPage } from "./pages/NewImportPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { UsersPage } from "./pages/UsersPage";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<RequireAuth />}>
            <Route element={<Layout />}>
              <Route index element={<HomePage />} />

              <Route element={<RequireRole allowed={ACCESS.authorize} />}>
                <Route path="autorizacion" element={<AuthorizePage />} />
              </Route>
              <Route element={<RequireRole allowed={ACCESS.inventory} />}>
                <Route path="inventario" element={<InventoryPage />} />
              </Route>
              <Route element={<RequireRole allowed={ACCESS.imports} />}>
                <Route path="importaciones" element={<ImportsPage />} />
                <Route path="importaciones/nueva" element={<NewImportPage />} />
              </Route>
              <Route element={<RequireRole allowed={ACCESS.lenses} />}>
                <Route path="referencias" element={<LensesPage />} />
              </Route>
              <Route element={<RequireRole />}>
                <Route path="usuarios" element={<UsersPage />} />
              </Route>

              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
