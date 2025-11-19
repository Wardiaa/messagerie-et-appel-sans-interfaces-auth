import axios from "axios";
const API = axios.create({ baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api" });

export const setToken = token => {
  if (token) API.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  else delete API.defaults.headers.common["Authorization"];
};

export default API;
