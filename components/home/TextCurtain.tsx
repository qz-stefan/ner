"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "@/components/home/home.module.css";

const SOURCE = "寅村仁兄姻大人阁下五月以后坡子街日日有事极不得闲顷归沐浴适奉手书三字石经确系真石闻尚有他石何不一并索来请函致太炎续寄全拓以便汇考也此颂台安德辉寅村仁兄姻大人阁下旬日未晤甚念日内有便入城乞来舍一谈谭三爷有信来否托书楹柱帖寄去未得复函尊处有函往乞一询及马殷纪功碑鄙意谓宜存之学宫墙壁此乃湖南一种史迹碑文碑字均不佳不足以为私藏宝贵之物不如公之省有也此颂撰安弟德辉顿首辛秋仁兄大人阁下别后岁更时深驰系每欲一通音候苦人事纷扰终日奔驰幸时晤民苏得悉近状西湖各胜足副高踪偶读新作不啻面语也愙斋集古录已点交府中尊记手收取有回条闻夫人女公子均有吴越之游跜蹙湘垣眉目殊不清醒得此行一开眼界又得室家团圜诚可喜可羡之事也此颂旅安弟叶德辉顿首甲子年正月初十日吟村仁兄姻大人阁下别经一年音问极少惟民苏日来过访时时得悉起居万安甚慰甚慰承赐欧书泉君墓志真可宝贵吾国讳言掘地发古致此等墨宝沉埋土中不见天日者不知凡几偶尔一出无不令人开眼开颜如此碑尤为欧书中麟凤何可再见也湘局四面楚歌年关异常萧索奈何余未多述即颂撰祎弟德辉顿首旧历十二月初四寅村仁兄姻大人阁下南中久不敢通问彼此心知弟自阁下去后即与此君未见一面曾与阁下言彼负阁下则何人不可负人之无良早知之矣通常燕会辙以读礼却之顷回苏展拜先茔因族谱事须与交长商榷到津已旬日忘记阁下居址昨嘱遇夫转达一切谅已详闻北京彼方耳目太多一闻弟与阁下行踪必引起是非议论亦甚恶之不愿闻见也阁下欲弟下榻尊府断不能也且到京一访皙子子奇阁下遇夫等三五人即翩然回苏过夏未进京前先约交长定日一谈即别不因此久住也先慈宅穸已定葬期择在秋间故不急回湘也在沪数晤大午孟其极多话说惟当与阁下面谈能否一来津同客数日可以罄怀相告也柯凤老江老太爷是否长见北来踪迹与何人最亲厂甸及隆福寺有旧书否弟此次重游江浙南京北固金焦等处三十年前恍如旧梦南旋拟登泰山谒孔林藉此延宕耳此颂撰安弟德辉顿首六月十四日寅村仁兄姻大人阁下顷奉环谕欣喜无似台从既难莅津弟旬日内尚不能北上然有多少话不能说也马总通历前三卷确系伪书自来藏书家皆再三考定弟亦屡为兄言之兄尚忆及否近闻宋板水经注已出见有人付珂罗版此间言之者众真耶讹耶此复并颂台安弟叶德辉顿首";
const COLUMN_COUNT = 28;
const CHARACTERS_PER_COLUMN = 35;

interface CurtainNode {
  x: number;
  y: number;
  previousX: number;
  previousY: number;
  homeX: number;
  homeY: number;
  character: string;
}

interface CurtainColumn {
  nodes: CurtainNode[];
  damping: number;
  response: number;
  linkLengths: number[];
}

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));

export function TextCurtain() {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const staticRef = useRef<HTMLDivElement>(null);
  const [canvasReady, setCanvasReady] = useState(false);
  const columns = useMemo(() => Array.from({ length: COLUMN_COUNT }, (_, columnIndex) => (
    Array.from(SOURCE.slice(columnIndex * CHARACTERS_PER_COLUMN, (columnIndex + 1) * CHARACTERS_PER_COLUMN))
  )), []);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    const staticLayer = staticRef.current;
    if (!root || !canvas || !staticLayer || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const interactionHalfWidth = 34;
    const interactionHalfHeight = 48;
    const maxDirectColumns = 3;
    const constraintIterations = 5;
    const gravity = 0.1;
    const maxHorizontalDisplacement = 138;
    const maxRotation = (10 * Math.PI) / 180;
    let curtainColumns: CurtainColumn[] = [];
    let frame = 0;
    let running = false;
    let settledFrames = 0;
    let width = 0;
    let height = 0;
    let visibleHeight = 0;
    let dpr = 1;
    let ink = "rgba(43, 38, 35, 0.76)";
    let font = "10px serif";
    let resizeTimer = 0;
    const pointer = { x: -10000, y: -10000, velocityX: 0, velocityY: 0, active: false };

    const constrainNode = (node: CurtainNode, depth: number) => {
      const horizontalLimit = 24 + maxHorizontalDisplacement * depth;
      node.x = clamp(node.x, node.homeX - horizontalLimit, node.homeX + horizontalLimit);
      node.y = clamp(node.y, node.homeY - 52 * depth, node.homeY + 58 * depth);
    };

    const draw = () => {
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);
      context.font = font;
      context.fillStyle = ink;
      context.textAlign = "center";
      context.textBaseline = "middle";
      curtainColumns.forEach((column, columnIndex) => {
        const nodes = column.nodes;
        const edgeDistance = Math.min(columnIndex, curtainColumns.length - 1 - columnIndex);
        const edgeAlpha = edgeDistance === 0 ? 0.64 : edgeDistance === 1 ? 0.82 : edgeDistance === 2 ? 0.94 : 1;
        nodes.forEach((node, index) => {
          const comparison = index > 0 ? nodes[index - 1] : nodes[index + 1];
          const depth = index / Math.max(1, nodes.length - 1);
          const rotationLimit = maxRotation * (0.2 + depth * 0.8);
          const tailDistance = nodes.length - 1 - index;
          const tailAlpha = tailDistance === 0 ? 0.62 : tailDistance === 1 ? 0.8 : tailDistance === 2 ? 0.93 : 1;
          let angle = 0;
          if (comparison) {
            const dx = index > 0 ? node.x - comparison.x : comparison.x - node.x;
            const dy = index > 0 ? node.y - comparison.y : comparison.y - node.y;
            angle = clamp(-Math.atan2(dx, Math.max(dy, 0.001)), -rotationLimit, rotationLimit);
          }
          const fadeStart = visibleHeight - 30;
          const fadeEnd = visibleHeight + 24;
          const boundaryAlpha = node.y <= fadeStart ? 1 : clamp(1 - (node.y - fadeStart) / Math.max(1, fadeEnd - fadeStart), 0, 1);
          context.globalAlpha = edgeAlpha * tailAlpha * boundaryAlpha;
          if (Math.abs(angle) > 0.008) {
            context.save();
            context.translate(node.x, node.y);
            context.rotate(angle);
            context.fillText(node.character, 0, 0);
            context.restore();
          } else {
            context.fillText(node.character, node.x, node.y);
          }
        });
      });
      context.globalAlpha = 1;
    };

    const buildCurtain = () => {
      const canvasRect = canvas.getBoundingClientRect();
      const curtainRect = root.getBoundingClientRect();
      const columnElements = Array.from(staticLayer.querySelectorAll<HTMLElement>("[data-curtain-column]"));
      const sampleCharacter = staticLayer.querySelector<HTMLElement>("[data-curtain-column] span");
      width = canvasRect.width;
      height = canvasRect.height;
      visibleHeight = curtainRect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      if (sampleCharacter) {
        const style = window.getComputedStyle(sampleCharacter);
        font = `${style.fontWeight || "400"} ${style.fontSize} ${style.fontFamily}`;
        ink = window.getComputedStyle(sampleCharacter.parentElement as Element).color;
      }
      curtainColumns = columnElements.map((columnElement, columnIndex) => {
        const nodes = Array.from(columnElement.querySelectorAll<HTMLElement>("span")).map((element) => {
          const rect = element.getBoundingClientRect();
          const homeX = rect.left - canvasRect.left + rect.width / 2;
          const homeY = rect.top - canvasRect.top + rect.height / 2;
          return { x: homeX, y: homeY, previousX: homeX, previousY: homeY, homeX, homeY, character: element.textContent || "" };
        });
        return {
          nodes,
          damping: 0.968 + ((columnIndex * 17) % 7) * 0.0014,
          response: 0.9 + ((columnIndex * 29) % 9) * 0.025,
          linkLengths: nodes.slice(1).map((node, index) => Math.hypot(node.homeX - nodes[index].homeX, node.homeY - nodes[index].homeY)),
        };
      });
      draw();
      setCanvasReady(true);
    };

    const step = () => {
      let largestMotion = 0;
      let largestDisplacement = 0;
      for (const column of curtainColumns) {
        const nodes = column.nodes;
        if (!nodes.length) continue;
        const pinned = nodes[0];
        pinned.x = pinned.homeX;
        pinned.y = pinned.homeY;
        pinned.previousX = pinned.homeX;
        pinned.previousY = pinned.homeY;
        for (let index = 1; index < nodes.length; index += 1) {
          const node = nodes[index];
          const depth = index / Math.max(1, nodes.length - 1);
          const velocityX = (node.x - node.previousX) * column.damping;
          const velocityY = (node.y - node.previousY) * column.damping + gravity;
          node.previousX = node.x;
          node.previousY = node.y;
          node.x += velocityX;
          node.y += velocityY;
          constrainNode(node, depth);
        }
        for (let iteration = 0; iteration < constraintIterations; iteration += 1) {
          for (let index = 1; index < nodes.length; index += 1) {
            const previous = nodes[index - 1];
            const node = nodes[index];
            const targetLength = column.linkLengths[index - 1];
            let dx = node.x - previous.x;
            let dy = node.y - previous.y;
            let distance = Math.hypot(dx, dy);
            if (distance < 0.0001) { distance = 0.0001; dx = 0; dy = 0.0001; }
            const difference = (distance - targetLength) / distance;
            if (index === 1) {
              node.x -= dx * difference;
              node.y -= dy * difference;
            } else {
              const correctionX = dx * difference * 0.5;
              const correctionY = dy * difference * 0.5;
              previous.x += correctionX;
              previous.y += correctionY;
              node.x -= correctionX;
              node.y -= correctionY;
            }
            constrainNode(node, index / Math.max(1, nodes.length - 1));
          }
        }
        for (let index = 1; index < nodes.length; index += 1) {
          const node = nodes[index];
          largestMotion = Math.max(largestMotion, Math.abs(node.x - node.previousX), Math.abs(node.y - node.previousY));
          largestDisplacement = Math.max(largestDisplacement, Math.abs(node.x - node.homeX), Math.abs(node.y - node.homeY));
        }
      }
      settledFrames = largestMotion < 0.035 && largestDisplacement < 0.12 ? settledFrames + 1 : 0;
      if (settledFrames > 18) {
        curtainColumns.forEach((column) => column.nodes.forEach((node) => {
          node.x = node.homeX; node.y = node.homeY; node.previousX = node.homeX; node.previousY = node.homeY;
        }));
        running = false;
        settledFrames = 0;
      }
    };

    const animate = () => {
      if (!running) return;
      step();
      draw();
      if (running) frame = requestAnimationFrame(animate);
    };
    const startAnimation = () => {
      if (running) return;
      running = true;
      settledFrames = 0;
      frame = requestAnimationFrame(animate);
    };
    const injectPointerImpulse = (pointerX: number, pointerY: number, velocityX: number, velocityY: number) => {
      const speed = Math.hypot(velocityX, velocityY);
      if (speed < 0.35) return false;
      const speedScale = Math.min(1, 28 / speed);
      const impulseX = velocityX * speedScale;
      const impulseY = velocityY * speedScale * 0.34;
      const rankWeights = [1, 0.34, 0.14];
      const nodeWeights = [0.18, 0.38, 0.68, 1, 0.68, 0.38, 0.18];
      const candidates = curtainColumns.map((column) => {
        const anchorX = column.nodes[0]?.homeX ?? -10000;
        const xDistance = Math.abs(anchorX - pointerX);
        let nearestNodeIndex = 1;
        let nearestYDistance = Number.POSITIVE_INFINITY;
        for (let nodeIndex = 1; nodeIndex < column.nodes.length; nodeIndex += 1) {
          const yDistance = Math.abs(column.nodes[nodeIndex].y - pointerY);
          if (yDistance < nearestYDistance) { nearestYDistance = yDistance; nearestNodeIndex = nodeIndex; }
        }
        return { column, xDistance, nearestYDistance, nearestNodeIndex };
      }).filter(({ xDistance, nearestYDistance }) => xDistance <= interactionHalfWidth && nearestYDistance <= interactionHalfHeight)
        .sort((first, second) => first.xDistance - second.xDistance).slice(0, maxDirectColumns);
      if (!candidates.length) return false;
      candidates.forEach(({ column, xDistance, nearestNodeIndex }, rank) => {
        const horizontalFalloff = (1 - xDistance / interactionHalfWidth) ** 1.35;
        const columnWeight = rankWeights[rank] * horizontalFalloff * column.response;
        for (let offset = -3; offset <= 3; offset += 1) {
          const nodeIndex = nearestNodeIndex + offset;
          if (nodeIndex < 1 || nodeIndex >= column.nodes.length) continue;
          const node = column.nodes[nodeIndex];
          const depth = nodeIndex / Math.max(1, column.nodes.length - 1);
          const localWeight = nodeWeights[offset + 3] * (0.58 + depth * 0.42) * columnWeight;
          node.previousX -= impulseX * 0.9 * localWeight;
          node.previousY -= impulseY * 0.72 * localWeight;
        }
      });
      return true;
    };
    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const rect = canvas.getBoundingClientRect();
      const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
      if (!inside) { pointer.active = false; return; }
      const nextX = event.clientX - rect.left;
      const nextY = event.clientY - rect.top;
      let receivedImpulse = false;
      if (pointer.active) {
        pointer.velocityX = pointer.velocityX * 0.25 + (nextX - pointer.x) * 0.75;
        pointer.velocityY = pointer.velocityY * 0.25 + (nextY - pointer.y) * 0.75;
        receivedImpulse = injectPointerImpulse(nextX, nextY, pointer.velocityX, pointer.velocityY);
      } else {
        pointer.velocityX = 0; pointer.velocityY = 0;
      }
      pointer.x = nextX; pointer.y = nextY; pointer.active = true;
      if (receivedImpulse) startAnimation();
    };
    const handlePointerLeave = () => {
      pointer.active = false; pointer.x = -10000; pointer.y = -10000; startAnimation();
    };
    const rebuildAfterResize = () => {
      cancelAnimationFrame(frame);
      running = false;
      settledFrames = 0;
      setCanvasReady(false);
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(buildCurtain, 40);
    };

    buildCurtain();
    const resizeObserver = new ResizeObserver(rebuildAfterResize);
    resizeObserver.observe(root);
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    document.addEventListener("mouseleave", handlePointerLeave);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(resizeTimer);
      resizeObserver.disconnect();
      window.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("mouseleave", handlePointerLeave);
    };
  }, []);

  return (
    <div ref={rootRef} className={`${styles.textCurtain} ${canvasReady ? styles.canvasReady : ""}`} aria-label="由叶德辉书信原文组成的二十八列文字珠帘">
      <span className={styles.curtainContactShadow} aria-hidden="true" />
      <canvas ref={canvasRef} className={styles.curtainCanvas} aria-hidden="true" />
      <div ref={staticRef} className={styles.curtainStatic} aria-hidden="true">
        {columns.map((characters, columnIndex) => (
          <p className={styles.curtainColumn} data-curtain-column key={columnIndex}>
            {characters.map((character, characterIndex) => <span key={`${columnIndex}-${characterIndex}`}>{character}</span>)}
          </p>
        ))}
      </div>
    </div>
  );
}
