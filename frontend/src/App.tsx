import Dashboard from "./pages/Dashboard";
import Homepage from "./pages/Homepage";
import { Route, Routes } from "react-router-dom";
import Profile from "./pages/Profile";
import { Toaster } from "sonner";
import Ajo from "./pages/Ajo";
import CreateAjo from "./pages/CreateAjo";
import AjoDetails from "./pages/AjoDetails";

const App = () => {
  return (
    <div>
      <Routes>
        <Route path="/" element={<Homepage />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/profile" element={<Profile />} />
        {/* <Route path="/ajo" element={<Ajo />} /> */}
        <Route path="/ajo/create-ajo" element={<CreateAjo />} />
        <Route path="/ajo/:ajoId/:ajoCore" element={<AjoDetails />} />
        <Route path="*" element={<div>404 Not Found</div>} />
      </Routes>
      <Toaster richColors position="top-center" />
    </div>
  );
};

export default App;
