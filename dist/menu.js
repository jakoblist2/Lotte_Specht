document.querySelectorAll(".site-menu").forEach((menu) => {
  const summary = menu.querySelector("summary");
  menu.querySelectorAll("nav a").forEach((link) => {
    link.addEventListener("click", () => { menu.open = false; });
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menu.open) {
      menu.open = false;
      summary.focus();
    }
  });
  document.addEventListener("click", (event) => {
    if (menu.open && !menu.contains(event.target)) menu.open = false;
  });
});
