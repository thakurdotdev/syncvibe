import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

// Conditionally add the Umami script based on NODE_ENV
if (process.env.NODE_ENV === "live") {
  const script = document.createElement("script");
  script.src = "https://slyn-analytics.vercel.app/api/script.js";
  script.defer = true;
  script.setAttribute("data-api-key", "7e37728a-2c1c-4189-a558-55431d572fb4");
  document.head.appendChild(script);
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
