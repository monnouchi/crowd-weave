// Stable visual choices are independent of walking habits and collision sizes.
// No nationality or ethnicity is inferred from appearance.
const LOOKS = [
  {
    skin: "#eec4a0",
    hair: "#3c343c",
    style: "crop",
    outfit: "shirt",
    width: 1,
  },
  {
    skin: "#c38d69",
    hair: "#292e3c",
    style: "bob",
    outfit: "coat",
    width: 0.96,
  },
  {
    skin: "#f5dbbc",
    hair: "#876348",
    style: "long",
    outfit: "skirt",
    width: 1,
  },
  {
    skin: "#ad7357",
    hair: "#d0c9c4",
    style: "short",
    outfit: "cardigan",
    width: 1.06,
    older: true,
  },
  {
    skin: "#e3ac86",
    hair: "#58403a",
    style: "bun",
    outfit: "shirt",
    width: 0.96,
  },
  {
    skin: "#906446",
    hair: "#242f39",
    style: "curls",
    outfit: "jacket",
    width: 1.06,
  },
  {
    skin: "#f3d0ab",
    hair: "#b9b4a9",
    style: "bob",
    outfit: "coat",
    width: 1,
    older: true,
  },
  {
    skin: "#c68b65",
    hair: "#3b2f32",
    style: "long",
    outfit: "shirt",
    width: 0.96,
  },
  {
    skin: "#e7bd95",
    hair: "#af9e8b",
    style: "thinning",
    outfit: "cardigan",
    width: 1.06,
    older: true,
  },
  {
    skin: "#bd8261",
    hair: "#42333b",
    style: "short",
    outfit: "skirt",
    width: 1,
  },
  {
    skin: "#f1d2b7",
    hair: "#71543c",
    style: "curls",
    outfit: "jacket",
    width: 0.96,
  },
  {
    skin: "#a87756",
    hair: "#242e3d",
    style: "bun",
    outfit: "coat",
    width: 1.06,
  },
];
export function appearanceFor(p, player = false) {
  const id = player
    ? 0
    : (p.appearanceId ??
      (p.friend ? p.id + 2 : (p.id ?? Math.round(p.x / 64))));
  return LOOKS[((id % LOOKS.length) + LOOKS.length) % LOOKS.length];
}
