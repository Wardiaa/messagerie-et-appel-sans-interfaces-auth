import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Home from "./pages/Home";
import { useAuth } from "./hooks/useAuth";

export default function App() {
  const auth = useAuth();

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login onLogin={auth.login} />} />
        <Route path="/signup" element={<Signup onSignup={auth.login} />} />
        <Route path="/" element={auth.user ? <Home auth={auth} /> : <Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
}
  