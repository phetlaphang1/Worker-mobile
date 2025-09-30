import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./styles/mobile-responsive.css";

// Add viewport meta tag for mobile
const viewport = document.querySelector('meta[name="viewport"]');
if (!viewport) {
  const meta = document.createElement('meta');
  meta.name = 'viewport';
  meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
  document.head.appendChild(meta);
}

// Add mobile detection class
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
if (isMobile) {
  document.body.classList.add('is-mobile');
}

createRoot(document.getElementById("root")!).render(<App />);
