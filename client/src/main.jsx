import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App.jsx"
import "./index.css"

if (import.meta.env.PROD) {
    const script = document.createElement("script")

    script.defer = true
    script.src = "https://cloud.umami.is/script.js"
    script.setAttribute(
        "data-website-id",
        "be07d2ea-3b87-4a58-9737-4b124635f28f"
    )

    document.head.appendChild(script)
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />)