import { GAME_NAME, ENGLISH_NAME, SHARE_TITLE } from "./branding.js";
export const GAME_URL = "https://monnouchi.github.io/crowd-weave/";
export function resultTotals(records) {
  const time = records.reduce((s, r) => s + r.time, 0),
    hits = records.reduce((s, r) => s + r.hits, 0),
    violations = records.reduce((s, r) => s + (r.violations || 0), 0);
  const clean = records.length === 5 && hits === 0 && violations === 0;
  return {
    time,
    hits,
    violations,
    clean,
    label: clean ? "すきまの名案内" : "みんなで最前列",
  };
}
export function resultText(records) {
  const r = resultTotals(records);
  return `${SHARE_TITLE}\n全5ステージ ${r.time.toFixed(1)}秒・接触${r.hits}回\n信号無視${r.violations}回 · ${r.label}\n${GAME_URL}`;
}
export function drawResultCard(records, scene) {
  const totals = resultTotals(records),
    c = document.createElement("canvas");
  c.width = 720;
  c.height = 520;
  const x = c.getContext("2d");
  x.fillStyle = "#f5f0df";
  x.fillRect(0, 0, 720, 520);
  x.fillStyle = "#293c40";
  x.fillRect(0, 0, 720, 116);
  x.fillStyle = "#f5f0df";
  x.font = "800 42px system-ui";
  x.fillText(GAME_NAME, 28, 62);
  x.font = "700 13px system-ui";
  x.textAlign = "right";
  x.fillText(ENGLISH_NAME.toUpperCase(), 692, 27);
  x.textAlign = "left";
  x.fillStyle = "#d4ad65";
  x.font = "700 19px system-ui";
  x.fillText("仲間全員、ライブ最前列へ！", 28, 96);
  const ratio = scene.width / 480,
    region = scene.weaveResultRegion || {
      x: 95 * ratio,
      y: 20 * ratio,
      width: 300 * ratio,
      height: 215 * ratio,
    };
  const fit = Math.min(360 / region.width, 270 / region.height),
    imageW = region.width * fit,
    imageH = region.height * fit;
  x.fillStyle = "#d6d9c8";
  x.fillRect(324, 146, 368, 278);
  x.drawImage(
    scene,
    region.x,
    region.y,
    region.width,
    region.height,
    328 + (360 - imageW) / 2,
    150 + (270 - imageH) / 2,
    imageW,
    imageH,
  );
  x.strokeStyle = "#293c40";
  x.lineWidth = 1;
  x.strokeRect(324.5, 146.5, 368, 278);
  x.fillStyle = "#536b63";
  x.font = "700 13px system-ui";
  x.fillText("05 / 05   ARRIVED", 28, 156);
  x.fillText("全5区間 / 到着タイム", 28, 198);
  x.fillStyle = "#293c40";
  x.font = "800 48px system-ui";
  x.fillText(totals.time.toFixed(1), 28, 250);
  const numberWidth = x.measureText(totals.time.toFixed(1)).width;
  x.font = "18px system-ui";
  x.fillText("秒", 28 + numberWidth + 8, 248);
  x.strokeStyle = "#879589";
  x.beginPath();
  x.moveTo(28, 271);
  x.lineTo(294, 271);
  x.stroke();
  x.font = "18px system-ui";
  x.fillText(`接触 ${totals.hits}回`, 28, 311);
  x.fillText(`信号無視 ${totals.violations}回`, 28, 352);
  x.fillStyle = "#28736b";
  x.font = "700 19px system-ui";
  x.fillText(totals.label, 28, 403);
  x.strokeStyle = "#879589";
  x.setLineDash([4, 5]);
  x.beginPath();
  x.moveTo(28, 448);
  x.lineTo(692, 448);
  x.stroke();
  x.setLineDash([]);
  x.fillStyle = "#293c40";
  x.font = "16px system-ui";
  x.fillText(GAME_URL, 28, 490);
  return c;
}

export async function shareResult(records, scene) {
  const text = resultText(records),
    c = drawResultCard(records, scene);
  const blob = await new Promise((resolve) => c.toBlob(resolve, "image/png"));
  if (!blob) throw Error("画像を作成できませんでした");
  const file = new File([blob], "crowd-weave-result.png", {
    type: "image/png",
  });
  if (navigator.canShare?.({ files: [file] }) && navigator.share) {
    try {
      await navigator.share({
        title: SHARE_TITLE,
        text,
        files: [file],
      });
      return "共有メニューを開きました";
    } catch (e) {
      if (e.name === "AbortError") return "共有をキャンセルしました";
    }
  }
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  return "結果画像を保存しました。文章は「文章コピー」からコピーできます";
}
