import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

// Conditionally add the Umami script based on NODE_ENV
if (process.env.NODE_ENV === "live") {
  const script = document.createElement("script");
  script.src = "https://app.slyn.tech/api/script.js";
  script.defer = true;
  script.setAttribute(
    "data-api-key",
    "sh_86af9f4f-5e12-4a0a-8768-7438e72c3233",
  );
  document.head.appendChild(script);
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
