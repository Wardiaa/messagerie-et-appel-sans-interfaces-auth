import { useState, useEffect } from "react";
import API, { setToken } from "../services/api";

export function useAuth() {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  });
  const [token, setT] = useState(localStorage.getItem("token"));

  useEffect(() => {
    setToken(token);
    if (token && !user) {
      // optionally fetch profile
    }
  }, [token]);

  const login = (tokenVal, userVal) => {
    setT(tokenVal);
    setToken(tokenVal);
    localStorage.setItem("token", tokenVal);
    localStorage.setItem("user", JSON.stringify(userVal));
    setUser(userVal);
  };
  const logout = () => {
    setT(null);
    setToken(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  };
  return { user, token, login, logout };
}
