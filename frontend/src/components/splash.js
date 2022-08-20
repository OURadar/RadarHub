export function removeSplash() {
  let o = document.getElementById("loading");
  if (o) o.style.opacity = 0;
  setTimeout(() => {
    document.getElementById("loading")?.remove();
    document.getElementById("app").classList.remove("hide");
  }, 500);
}
