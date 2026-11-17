// ===========================================================================
// STELLIUM · Home (versão mobile; no computador fica numa coluna de celular)
//
// 1. Vidro 3D do símbolo (dupla refração, estúdios claro e escuro)
// 2. O símbolo mora no topo de cada seção e viaja entre elas (transições)
// 3. Desenho de cada quadro
// 4. Rolagem suave (Lenis)
// 5. Entradas de texto e pilha de cartões (GSAP)
// 6. Tema, botão de subir, topo e menu
// ===========================================================================
import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';

const { gsap, ScrollTrigger, Lenis } = window;
gsap.registerPlugin(ScrollTrigger);

// celular: coluna de até 430 px (inclusive no computador estreito)
// desktop (≥ 900 px, igual ao CSS): 3D na largura toda e cartões em cascata
const LARGURA_MAX = 430;
const desktop = matchMedia('(min-width: 900px)');
const reduzirMovimento = matchMedia('(prefers-reduced-motion: reduce)').matches;
const suave = x => { x = Math.min(Math.max(x, 0), 1); return x * x * (3 - 2 * x); };

// ---------------------------------------------------------------------------
// 1. VIDRO 3D
// ---------------------------------------------------------------------------
// Símbolo oficial (01 - Identidade Visual/02 - Logotipo/SVG/simbolo-positivo.svg)
const SVG = `<svg viewBox="0 0 126 126" xmlns="http://www.w3.org/2000/svg">
<g transform="matrix(1,0,0,1,-3697.010569,-696.049572)">
<g transform="matrix(1,0,0,1,2160,0)"><g transform="matrix(-1,0.000473,0.000473,1,1593.333999,819.121794)"><path d="M10.155,-33.821C23.34,-38.701 29.682,-28.1 29.936,-21.029C30.237,-12.682 23.34,-4.883 10.155,-0.002C-3.03,4.877 -15.549,3.374 -17.809,-3.359C-20.069,-10.092 -3.03,-28.942 10.155,-33.821"/></g></g>
<g transform="matrix(1,0,0,1,2160,0)"><g transform="matrix(-0.999207,-0.039815,-0.039815,0.999207,1554.361,783.763949)"><path d="M5.388,-48.882C13.32,-46.266 18.241,-37.091 18.242,-23.032C18.241,-8.973 12.486,2.246 5.388,2.029C-1.711,1.811 -13.476,-20.711 -13.475,-34.77C-13.476,-48.828 -1.333,-51.097 5.388,-48.882"/></g></g>
<g transform="matrix(1,0,0,1,2160,0)"><g transform="matrix(0.808745,-0.588159,-0.588159,-0.808745,1604.153258,714.057969)"><path d="M-10.829,-5.952C2.354,-10.831 8.698,-0.23 8.952,6.84C9.253,15.188 2.355,22.987 -10.829,27.867C-24.014,32.746 -36.534,31.243 -38.793,24.51C-41.053,17.777 -24.014,-1.072 -10.829,-5.952"/></g></g>
<g transform="matrix(1,0,0,1,2160,0)"><g transform="matrix(0.831775,-0.555113,-0.555113,-0.831775,1662.292604,736.174099)"><path d="M-12.434,-4.989C-4.502,-2.374 0.419,6.802 0.42,20.861C0.42,34.919 -5.335,46.139 -12.434,45.921C-19.533,45.703 -31.297,23.181 -31.297,9.123C-31.297,-4.936 -19.154,-7.205 -12.434,-4.989"/></g></g>
<g transform="matrix(1,0,0,1,2160,0)"><g transform="matrix(-0.784976,-0.619526,-0.619526,0.784976,1610.880613,787.750199)"><path d="M-24.285,-47.026C-17.186,-46.808 -5.422,-24.286 -5.423,-10.228C-5.422,3.831 -17.565,6.1 -24.285,3.884C-32.217,1.268 -37.139,-7.906 -37.139,-21.965C-37.139,-36.023 -31.384,-47.243 -24.285,-47.026"/></g></g>
</g></svg>`;

const canvas = document.getElementById('vidro');
// fundo transparente: a cor de fundo vem da própria página
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
// qualidade alta: resolução total da tela (iPhone = 3x). Com zoom de pinça,
// o 3D se redesenha com mais resolução (até 4x) em vez de só ampliar a imagem.
const DPR_BASE = Math.min(devicePixelRatio || 1, 3);
const DPR_TETO = 4;
let dpr = DPR_BASE;
renderer.setPixelRatio(dpr);
renderer.toneMapping = THREE.NeutralToneMapping;

// mesmos tons do fundo da página; FUNDO é a cor atual (muda com o tema)
const FUNDOS = { claro: new THREE.Color(0xf3f3f1), escuro: new THREE.Color(0x070708) };
const FUNDO = FUNDOS.claro.clone();
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
camera.position.set(0, 0, 11);

// Estúdio: o que o vidro reflete e refrata (ninguém vê o estúdio, só o vidro).
// Claro: base clara + faixas escuras. Escuro: base preta + faixas de luz.
// "espelho" acrescenta anéis empilhados no horizonte (as faixas das paredes).
function montarEstudio(espelho, escuro) {
  const s = new THREE.Scene();
  s.add(new THREE.Mesh(new THREE.SphereGeometry(20, 32, 16),
    new THREE.MeshBasicMaterial({ color: escuro ? 0x000000 : 0xf6f6f4, side: THREE.BackSide })));
  const faixa = new THREE.MeshBasicMaterial({
    color: escuro ? new THREE.Color(0xffffff).multiplyScalar(3) : new THREE.Color(0x0c0c0c), side: THREE.DoubleSide });
  const ambar = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff9a3c).multiplyScalar(1.4), side: THREE.DoubleSide });
  const placa = (w, h, x, y, z, m = faixa) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
    p.position.set(x, y, z); p.lookAt(0, 0, 0); s.add(p);
  };
  placa(12, 4, 0, 9, 2); placa(2.5, 16, -9, 0, 2); placa(1.4, 16, 9, 0, -1); placa(12, 1.2, 0, -7, 7);
  placa(0.35, 16, -5, 0, 8); placa(0.6, 16, 6, 0, 7); placa(16, 0.3, 0, 4, 8); placa(16, 0.5, 0, -8, -6);
  placa(3, 18, -9, 0, -8); placa(2, 18, 9, 0, -7); placa(18, 3, 0, 8, -9); placa(18, 2, 0, -8, -9);
  placa(1.6, 1.6, -5, 4, -5, ambar); placa(0.8, 0.8, 6, -3, 4, ambar);
  const horizonte = new THREE.Mesh(new THREE.CylinderGeometry(15, 15, 2.4, 64, 1, true, -Math.PI / 2, Math.PI), faixa);
  horizonte.position.y = -0.6; s.add(horizonte);
  if (espelho) {
    const cinza = new THREE.Color(escuro ? 0x777777 : 0x8a8a8a);
    const preto = new THREE.Color(escuro ? 0x000000 : 0x060606);
    const branco = new THREE.Color(0xffffff).multiplyScalar(escuro ? 3 : 1.6);
    [[-3.4, .9, cinza], [-2.6, .7, preto], [-1.8, .9, branco], [-1, .35, preto], [-.45, .6, cinza],
     [.1, .3, preto], [.7, 1, branco], [1.5, .5, preto], [2.2, .7, cinza], [3, .4, preto], [3.8, 1.2, branco]]
      .forEach(([y, h, cor]) => {
        const anel = new THREE.Mesh(new THREE.CylinderGeometry(14, 14, h, 96, 1, true),
          new THREE.MeshBasicMaterial({ color: cor, side: THREE.DoubleSide }));
        anel.position.y = y; s.add(anel);
      });
  }
  return s;
}
// estúdios em alta resolução (512); cada tema é preparado só quando é usado
const cubos = {};
function estudioDoTema(tema) {
  if (!cubos[tema]) {
    cubos[tema] = {};
    for (const tipo of ['limpo', 'espelho']) {
      const alvo = new THREE.WebGLCubeRenderTarget(512,
        { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
      new THREE.CubeCamera(0.1, 50, alvo).update(renderer, montarEstudio(tipo === 'espelho', tema === 'escuro'));
      cubos[tema][tipo] = alvo.texture;
    }
  }
  return cubos[tema];
}

// Vidro em dois passos: 1) grava as normais das faces de trás; 2) a face da
// frente calcula a luz entrando e saindo (dupla refração + reflexão interna).
const tamanho = new THREE.Vector2(1, 1);
const alvoCostas = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
const vertexComum = `
  varying vec3 vPos; varying vec3 vNormal;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vPos = wp.xyz; vNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;
const matCostas = new THREE.ShaderMaterial({
  side: THREE.BackSide, vertexShader: vertexComum,
  fragmentShader: `varying vec3 vPos; varying vec3 vNormal;
    void main(){ gl_FragColor = vec4(normalize(vNormal) * 0.5 + 0.5, 1.0); }`,
});
const vidro = new THREE.ShaderMaterial({
  uniforms: {
    envMap: { value: estudioDoTema('claro').limpo },          // estúdio limpo (miolo das faces)
    envEspelho: { value: estudioDoTema('claro').espelho },    // estúdio com faixas (paredes e quinas)
    costas: { value: alvoCostas.texture }, resolucao: { value: tamanho },
    ior: { value: 1.5 }, dispersao: { value: 0.35 }, reflexo: { value: 1.0 },
    luzDir: { value: new THREE.Vector3(Math.cos(0.26), Math.sin(0.26), 0.35).normalize() },
    luzForca: { value: 0.8 }, luzCor: { value: new THREE.Color(1, .96, .9) },
    revelar: { value: 0 },                          // 0 → 1 na abertura da página
    tom: { value: 0.7 },                            // corpo cinza-prata (só no claro)
    fundo: { value: FUNDO },
    chapado: { value: 0 },                          // 0 = vidro; 1 = cor única, como o logo (rodapé)
    tinta: { value: new THREE.Color(36 / 255, 36 / 255, 36 / 255) },   // preto a 85% sobre o fundo, igual ao nome
  },
  vertexShader: vertexComum,
  fragmentShader: `
    uniform samplerCube envMap, envEspelho;
    uniform sampler2D costas;
    uniform vec2 resolucao;
    uniform float ior, dispersao, reflexo, luzForca, revelar, tom, chapado;
    uniform vec3 luzDir, luzCor, fundo, tinta;
    varying vec3 vPos; varying vec3 vNormal;
    vec3 atravessar(vec3 I, vec3 N, vec3 N2, bool temCostas, float n) {
      vec3 r1 = refract(I, N, 1.0 / n);            // entra no vidro
      if (!temCostas) return r1;
      vec3 r2 = refract(r1, -N2, n);               // sai pela face de trás
      if (dot(r2, r2) < 1e-4) r2 = reflect(r1, -N2);   // reflexão interna total
      return r2;
    }
    void main() {
      vec3 I = normalize(vPos - cameraPosition);
      vec3 N = normalize(vNormal);
      vec4 c = texture2D(costas, gl_FragCoord.xy / resolucao);
      bool temCostas = c.a > 0.5;
      vec3 N2 = normalize(c.rgb * 2.0 - 1.0);
      float d = dispersao * 0.03;                  // arco-íris: cada cor refrata um pouco diferente
      vec3 rR = atravessar(I, N, N2, temCostas, ior - d);
      vec3 rG = atravessar(I, N, N2, temCostas, ior);
      vec3 rB = atravessar(I, N, N2, temCostas, ior + d);
      vec3 limpo = vec3(textureCube(envMap, rR).r, textureCube(envMap, rG).g, textureCube(envMap, rB).b);
      vec3 espelho = vec3(textureCube(envEspelho, rR).r, textureCube(envEspelho, rG).g, textureCube(envEspelho, rB).b);
      float cosT = clamp(dot(-I, N), 0.0, 1.0);
      // miolo limpo só quando a luz entra pela face da frente e sai pela de trás
      float tras = temCostas ? smoothstep(0.5, 0.85, dot(N2, I)) : 1.0;
      float frente = smoothstep(0.55, 0.85, cosT) * tras;
      vec3 col = mix(espelho, limpo, frente);
      col *= mix(vec3(1.0), vec3(0.84, 0.865, 0.88), tom * frente);
      float F = 0.04 + 0.96 * pow(1.0 - cosT, 5.0);   // Fresnel
      col = mix(col * 0.97, textureCube(envEspelho, reflect(I, N)).rgb, clamp(F * reflexo, 0.0, 1.0));
      // luz lateral: só acende onde reflete (quinas e paredes), miolo limpo
      vec3 L = normalize(luzDir);
      float gR = pow(max(dot(reflect(I, N), L), 0.0), 220.0);
      float gT = pow(max(dot(rG, L), 0.0), 90.0);
      col += luzCor * luzForca * (2.2 * gR + 1.4 * gT) * (1.0 - 0.85 * frente);
      col = mix(fundo, col, revelar);
      gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      gl_FragColor.rgb = mix(gl_FragColor.rgb, tinta, chapado);   // os efeitos saem e fica a cor da marca
    }`,
});

// Símbolo: 5 blocos de vidro extrudados do SVG, com quina chanfrada.
// "giro" recebe posição/escala/inclinação; "simbolo" gira devagar dentro dele.
const DIAMETRO = 3.0;
const giro = new THREE.Group();
const simbolo = new THREE.Group();
giro.add(simbolo); scene.add(giro);
{
  const formas = new SVGLoader().parse(SVG).paths.flatMap(p => SVGLoader.createShapes(p));
  const opcoes = { depth: 14, bevelEnabled: true, bevelThickness: 2.4, bevelSize: 2.4, bevelSegments: 1, curveSegments: 96 };
  const geos = formas.map(f => new THREE.ExtrudeGeometry(f, opcoes));
  const caixa = new THREE.Box3();
  geos.forEach(g => { g.computeBoundingBox(); caixa.union(g.boundingBox); });
  const centro = caixa.getCenter(new THREE.Vector3());
  const escala = DIAMETRO / Math.max(caixa.max.x - caixa.min.x, caixa.max.y - caixa.min.y);
  geos.forEach((g, i) => {
    g.translate(-centro.x, -centro.y, -centro.z);
    g.rotateX(Math.PI);                       // SVG tem Y para baixo
    g.scale(escala, escala, escala);
    g.computeBoundingBox();
    const c = g.boundingBox.getCenter(new THREE.Vector3());
    g.translate(-c.x, -c.y, -c.z);            // cada pétala gira em torno do próprio centro
    g.deleteAttribute('uv');
    const petala = new THREE.Mesh(toCreasedNormals(g, THREE.MathUtils.degToRad(30)), vidro);
    const radial = new THREE.Vector3(c.x, c.y, 0).normalize();
    petala.userData = { base: c.clone(), radial, tangente: new THREE.Vector3(-radial.y, radial.x, 0), fase: i * 1.2566 };
    petala.position.copy(c);
    simbolo.add(petala);
  });
}

// ---------------------------------------------------------------------------
// 2. ONDE O SÍMBOLO ESTÁ
// Ele mora no topo de cada seção (div.ancora) e rola junto. Entre uma seção e a
// próxima ele viaja inteiro: cresce um pouco, faz um movimento e volta ao normal.
// Os GIROS só avançam (volta completa = forma igual à original).
// ---------------------------------------------------------------------------
const ancoras = [...document.querySelectorAll('.ancora')];
const TRANSICOES = ['abrir-torcer', 'onda', 'profundidade', 'espiral']; // hero→quem→atuação→modelo→contato
const abertura = { valor: 0 };      // 0 = pétalas espalhadas ao abrir o site, 1 = símbolo formado

// posições medidas UMA vez (e de novo quando o layout muda); a cada quadro só
// se subtrai a rolagem — sem forçar o navegador a recalcular o layout
const medidas = { escalas: [], petalas: [], abrir: [], fechar: [], chegada: [], cartoes: [], atuacao: [0, 0], altoMax: 200 };
function medir() {
  // espaço do símbolo aberto (o mesmo das regras .ancora do CSS)
  medidas.altoMax = desktop.matches ? Math.max(innerHeight * 0.36, 260) : Math.max(innerHeight * 0.26, 200);
  // no desktop a tela é larga e o símbolo seria medido pela altura: usa a escala própria
  medidas.escalas = ancoras.map(a => parseFloat(desktop.matches ? a.dataset.escalaDesktop : a.dataset.escala) || 0.6);
  if (desktop.matches) {   // computador: símbolo grande, do tamanho da coluna da direita do hero
    const visH = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const a = ancoras[0].getBoundingClientRect();
    const alvoPx = Math.min(a.width * 0.92, innerHeight * 0.7, 820);
    medidas.escalas[0] = alvoPx * visH / (DIAMETRO * (alturaCanvas || innerHeight));
  }
  // tamanho das pétalas (o anel fica do mesmo tamanho) e quanto abre na viagem que sai dali
  medidas.petalas = ancoras.map(a => parseFloat(a.dataset.petala) || 1);
  medidas.abrir = ancoras.map(a => a.dataset.abrir !== undefined ? parseFloat(a.dataset.abrir) : 1);
  medidas.fechar = ancoras.map(a => parseFloat(a.dataset.fechar) || 4);
  medidas.chegada = ancoras.map(a => parseFloat(a.dataset.chegada) || 0.45);   // onde (fração da tela) ele assenta
  const sec = document.getElementById('atuacao').getBoundingClientRect();
  medidas.atuacao = [sec.top + scrollY, sec.bottom + scrollY];
  // computador: cada degrau da pilha fica logo abaixo do texto do cartão
  // (o próximo cobre só a faixa vazia de baixo); no celular vale o do CSS
  const pilha = document.querySelector('.cartoes'), lista = [...pilha.querySelectorAll('.cartao')];
  if (desktop.matches) {
    const fimTexto = Math.max(...lista.map(c => { const p = c.querySelector('p'); return p.offsetTop + p.offsetHeight; }));
    pilha.style.setProperty('--degrau', Math.ceil(fimTexto + 32) + 'px');
  } else pilha.style.removeProperty('--degrau');
  medidas.cartoes = lista.map(c => parseFloat(getComputedStyle(c).top) || 0);
}

// raio do símbolo montado, em px da tela (para saber quando a pétala de cima
// passa da borda de cima)
function raioSimbolo(escala) {
  const visH = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const encaixe = Math.min(1, (visH * camera.aspect * 0.78) / DIAMETRO);
  return 0.5 * DIAMETRO * encaixe * escala * (alturaCanvas || innerHeight) / visH;
}

// Espaço do símbolo no topo de cada seção (menos o hero): fica pequeno
// enquanto o símbolo está aberto viajando e só abre junto com ele se
// fechando para assentar ali (sem buraco vazio esperando o símbolo).
// espacos[j] (0 a 1) é decidido em estadoSimbolo e aplicado no quadro seguinte.
// Devolve o centro de cada espaço na tela (onde o símbolo assenta).
const primeiroCartao = document.querySelector('.cartao');
const ALTO_MIN = () => (desktop.matches ? 64 : 48);
const espacos = [];
function definirEspacos(i, chegando) {   // i: último lugar já alcançado
  ancoras.forEach((_, j) => { espacos[j] = j <= i ? 1 : j === i + 1 ? chegando : 0; });
}
function ancorasVivas() {
  const min = ALTO_MIN(), max = medidas.altoMax;
  return ancoras.map((a, i) => {
    const r = a.getBoundingClientRect();
    if (i === 0) return r.top + r.height / 2;
    // atrás dos cartões: segue o primeiro cartão (que para no meio da tela), então
    // o símbolo fica atrás dele enquanto a pilha está parada
    if (a.classList.contains('fantasma')) { const c = primeiroCartao.getBoundingClientRect(); return c.top + c.height / 2; }
    const e = espacos[i] || 0;
    const alto = Math.round(min + (max - min) * e);
    if (alto !== a._alto) { a._alto = alto; a.style.height = alto + 'px'; a.style.minHeight = '0px'; }
    // centro do espaço já aberto: o topo não depende da altura dele, então o
    // caminho do símbolo não fica "brigando" com o espaço que abre
    return r.top + max / 2;
  });
}

const lugarRodape = document.querySelector('.rodape-simbolo');
const marcaRodape = document.querySelector('.rodape-marca');
// ida para o logo: 0 → 1 em ~1,6 s quando a página chega ao fim
let rodapeAlvo = 0, rodapeAnda = 0;
let CENTRO_TELA = 0.48;   // altura do centro do símbolo aberto (fração da tela)
const RODAPE_DURACAO = 2.2;   // chegar ao meio ~1 s, pausa ~0,4 s, ir para o lado ~0,8 s
function estadoSimbolo() {
  const H = innerHeight;
  // meio da tela de verdade: no iPhone a página aparece também atrás das barras
  // do Safari, então o meio é o da tela inteira (altura do 3D), não o de innerHeight
  const meioTela = CENTRO_TELA * (alturaTela || H);   // um pouco acima do meio exato: visualmente centrado
  rodapeAlvo = 0;
  const centros = ancorasVivas();
  const escala = i => medidas.escalas[i];
  for (let i = 0; i < centros.length - 1; i++) {
    // montado: sobe junto com o título até a pétala de cima passar da borda de
    // cima da tela; aí começa a viagem (abre e fica girando no meio da tela)
    // e termina quando a âncora i+1 chega a 45% da tela
    const inicio = raioSimbolo(escala(i)) * 0.85;
    if (centros[i] > inicio) {
      definirEspacos(i, 0);
      return { sy: centros[i], escala: escala(i), petala: medidas.petalas[i], global: i, aberto: 0 };
    }
    const alvo = medidas.chegada[i + 1] * H;
    const vao = Math.max(centros[i + 1] - centros[i] - (alvo - inicio), 1);
    const p = (inicio - centros[i]) / vao;
    if (p < 1) {
      const e = suave(p);
      // caminho base: de onde saiu até a âncora seguinte
      const alto = inicio + (meioTela - inicio) * suave(Math.min(p * 2, 1));
      const chegada = Math.min(Math.max((alvo + 0.35 * H - centros[i + 1]) / (0.35 * H), 0), 1);
      const base = alto + (centros[i + 1] - alto) * chegada * chegada;
      // abre logo no começo da viagem, fica aberto no centro da tela girando,
      // e fecha ao chegar na próxima seção
      // 0 → 1 (aberto) → 0; data-fechar no destino: quanto maior, mais tarde e
      // mais rápido ele fecha ao chegar
      const viagem = suave(p * 4) * suave((1 - p) * medidas.fechar[i + 1]);   // abre rápido no começo
      const aberto = viagem * medidas.abrir[i];
      // o espaço da próxima seção abre no mesmo ritmo em que o símbolo fecha
      definirEspacos(i, p < 0.5 ? 0 : 1 - viagem);
      return {
        sy: base + (meioTela - base) * aberto,
        escala: escala(i) + (escala(i + 1) - escala(i)) * e,
        petala: medidas.petalas[i] + (medidas.petalas[i + 1] - medidas.petalas[i]) * e,
        global: i + p,     // posição contínua: 1,5 = meio da transição quem→atuação
        aberto,
      };
    }
  }
  // depois do último lugar do símbolo: sobe com o título e, quando a pétala
  // de cima passa da borda, abre e fica aberto no meio da tela
  const u = centros.length - 1;
  definirEspacos(u, 0);
  const inicio = raioSimbolo(escala(u)) * 0.85;
  const p = Math.max(0, (inicio - centros[u]) / (0.6 * H));
  let aberto = suave(p * 2.5) * medidas.abrir[u];
  // depois de aberto, segue crescendo até sair da tela e não volta no corpo
  // (só no rodapé, quando vira o logotipo)
  // no computador o símbolo é maior e o Quem somos chega antes: sai mais cedo
  let alem = desktop.matches ? suave((p - 0.05) / 0.4) : suave((p - 0.2) / 0.6);
  const alto = centros[u] + (meioTela - centros[u]) * suave(Math.min(p * 2, 1)) * (p > 0 ? 1 : 0);
  let sy = p > 0 ? alto + (meioTela - alto) * aberto : centros[u];
  let esc = escala(u), dx = 0;
  if (desktop.matches) {   // computador: o símbolo mora na coluna da direita do hero
    const ra = ancoras[u].getBoundingClientRect(), cv = canvas.getBoundingClientRect();
    dx = ra.left + ra.width / 2 - (cv.left + cv.width / 2);
  }
  // chegando ao fim da página: fecha, encolhe e vai para o lado do nome no
  // rodapé, onde vira o símbolo chapado (é ele o símbolo da marca ali)
  const restante = document.documentElement.scrollHeight - H - scrollY;
  // só quando a página bate no fim: aí a ida para o logo anda sozinha (no
  // tempo, não na rolagem); subindo um pouco, ela volta
  rodapeAlvo = restante <= 4 ? 1 : 0;
  // por partes: 1) fecha, encolhe e vira chapado no MEIO do logo (sai firme
  // e desacelera); 2) para um instante; 3) desliza para a esquerda e o nome
  // aparece (fade + desfoque) nessa mesma hora
  const fim = 1 - Math.pow(1 - Math.min(rodapeAnda / 0.45, 1), 3);
  // ida para o lado: suave, sai e desacelera até encaixar (sem elástico)
  const ladoT = Math.min(Math.max((rodapeAnda - 0.62) / 0.38, 0), 1);
  const lado = suave(ladoT);
  const nomeT = suave(ladoT * 1.15);
  if (fim > 0) {
    const r = lugarRodape.getBoundingClientRect(), m = marcaRodape.getBoundingClientRect();
    const cv = canvas.getBoundingClientRect(), centroCv = cv.left + cv.width / 2;
    const escRodape = r.width / (2 * raioSimbolo(1));
    const meio = m.left + m.width / 2, lugar = r.left + r.width / 2;
    // nasce já no lugar do logo (antes vinha do anel gigante e as pétalas
    // passavam por cima do Contato): só surge, encolhe um pouco e assenta
    sy = r.top + r.height / 2;
    dx = meio + (lugar - meio) * lado - centroCv;
    esc = escRodape * (1 + 0.6 * (1 - fim));
    aberto = 0;
    alem = 0;
  }
  return { sy, dx, escala: esc, petala: medidas.petalas[u], global: u, aberto, alem, fim, nome: nomeT };
}

// Mola + limite de velocidade: num arrasto rápido o símbolo não chicoteia.
// A posição chega em ~0,35 s e as transições não passam de 0,65 por segundo.
const VEL_MAX_TRANSICAO = 0.65;
const mola = { sy: null, dx: 0, escala: 0, petala: 1, global: 0, aberto: 0, alem: 0, fim: 0, nome: 0 };
function seguirComMola(est, dt) {
  if (mola.sy === null) Object.assign(mola, { dx: 0, fim: 0 }, est);
  const f = 1 - Math.exp(-dt * 3.2);
  mola.sy += (est.sy - mola.sy) * f;
  mola.escala += (est.escala - mola.escala) * f;
  mola.petala += (est.petala - mola.petala) * f;
  mola.dx += ((est.dx || 0) - mola.dx) * f;
  // rodapé: a ida já é suave no tempo, então sem mola; e quanto mais perto do
  // logo, mais preso à página (no lugar, acompanha a rolagem sem arrasto)
  mola.fim = est.fim || 0;
  mola.nome = est.nome || 0;
  if (mola.fim > 0) {
    const preso = mola.fim;
    mola.sy += (est.sy - mola.sy) * preso;
    mola.dx += ((est.dx || 0) - mola.dx) * preso;
    mola.escala += (est.escala - mola.escala) * preso;
  }
  mola.aberto += (est.aberto - mola.aberto) * (1 - Math.exp(-dt * 5));   // abrir/fechar responde mais rápido
  mola.alem += ((est.alem || 0) - mola.alem) * (1 - Math.exp(-dt * 5));
  if (mola.fim > 0) { mola.aberto = est.aberto; mola.alem = est.alem || 0; }   // rodapé: sem o anel aberto no caminho
  // pulo de mais de uma seção (rolagem rápida, menu, botão de subir): não
  // repassa as transições do caminho uma a uma (o símbolo ficava segundos se
  // mexendo ao voltar ao início); só desliza até lá, girando normal
  if (Math.abs(est.global - mola.global) > 1) mola.global = est.global;
  const passo = (est.global - mola.global) * (1 - Math.exp(-dt * 4));
  const limite = VEL_MAX_TRANSICAO * dt;
  mola.global += Math.max(-limite, Math.min(limite, passo));
  const tipo = Math.min(Math.floor(mola.global), TRANSICOES.length - 1);
  const progresso = Math.min(Math.max(mola.global - tipo, 0), 1);
  const emTransicao = progresso > 0 && progresso < 1;
  return {
    sy: mola.sy, dx: mola.dx, escala: mola.escala, petala: mola.petala, aberto: mola.aberto, alem: mola.alem, fim: mola.fim, nome: mola.nome, tipo,
    progresso: emTransicao ? progresso : 0,
    amplitude: emTransicao ? Math.sin(Math.PI * progresso) : 0,   // 0 → 1 → 0
  };
}

// ---------------------------------------------------------------------------
// 3. DESENHO DE CADA QUADRO
// ---------------------------------------------------------------------------
// Tamanho do 3D: largura da coluna; altura = a tela inteira (100lvh no CSS,
// que já inclui a área atrás das barras do celular e não muda quando elas
// aparecem/somem). Só é medido quando a janela muda de tamanho.
let larguraCanvas = 0, alturaCanvas = 0, alturaTela = 0;
function ajustarCanvas() {
  const larguraPagina = document.documentElement.clientWidth || innerWidth;   // sem a barra de rolagem
  const w = desktop.matches ? larguraPagina : Math.min(larguraPagina, LARGURA_MAX);
  const h = Math.round(canvas.getBoundingClientRect().height) || innerHeight;
  if (!w || !h || (w === larguraCanvas && h === alturaCanvas)) return;
  larguraCanvas = w; alturaCanvas = h; alturaTela = h;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}
addEventListener('resize', ajustarCanvas);

const qA = new THREE.Quaternion(), qB = new THREE.Quaternion(), qC = new THREE.Quaternion();
let giroPetalas = 0;
let DESFOQUE = 0;   // desfoque do símbolo 3D em px (no rodapé volta a 0)
let OPACIDADE = 1;   // opacidade do símbolo 3D (no rodapé ele volta a 100%)
let ROLAR = 1;   // voltas da pétala no próprio eixo por volta do anel (só aberto); 0 = não gira
const pos = new THREE.Vector3();
const ponteiro = { x: 0, y: 0, ax: 0, ay: 0 };   // inclinação seguindo o mouse (só computador)
let t = 0;
let anguloGiro = 0, chaveRodape = '';
// giro reativo: acelera conforme a rapidez com que o símbolo abre/fecha
let abertoAntes = 0, fimAntes = 0, giroExtra = 0;
const GIRO_BASE = 0.2, GIRO_POR_ABERTURA = 0.9;
const nomeRodape = document.querySelector('.rodape-nome');
const textosRodape = [...document.querySelectorAll('.rodape-linha > p')];   // slogan, empresa, ©: de cima para baixo
let CRESCER_PETALA = 1.3;   // aberto, cada pétala fica no máximo 30% maior
let PERTO_VIAGEM = 1.10;    // aberto, o anel ocupa ~a altura da tela (as pétalas de cima e de baixo nas bordas)
// AJUSTE TEMPORÁRIO: barrinhas na lateral para testar o símbolo aberto
// (anel = distância entre as pétalas; pos = altura na tela; pét = tamanho;
// giro = giro de cada pétala no próprio eixo). Um botão com seta abre e fecha.
{
  const painel = document.createElement('div');
  painel.style.cssText = 'position:fixed;top:calc(var(--topo) + 16px);left:calc(var(--lateral) + 4px);z-index:30;' +
    'display:flex;flex-direction:column;align-items:flex-start;gap:8px;pointer-events:none';
  painel.setAttribute('data-lenis-prevent', '');
  const vidroClaro = 'background:rgba(255,255,255,.8);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);' +
    'box-shadow:0 0 0 1px rgba(0,0,0,.08);color:#222;font:500 12px/16px ui-monospace,monospace';
  // topo: botão com seta + aviso
  const linha = document.createElement('div');
  linha.style.cssText = 'display:flex;align-items:center;gap:8px;pointer-events:none';
  const botao = document.createElement('button');
  botao.type = 'button'; botao.setAttribute('aria-label', 'Abrir ajustes');
  botao.style.cssText = vidroClaro + ';width:36px;height:36px;border:0;border-radius:50%;padding:0;cursor:pointer;' +
    'display:grid;place-items:center;pointer-events:auto';
  botao.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" ' +
    'stroke-linecap="round" stroke-linejoin="round" style="transition:transform .4s"><path d="M6 3l5 5-5 5"/></svg>';
  const seta = botao.firstChild;
  const aviso = document.createElement('span');
  aviso.textContent = 'Abra para editar';
  aviso.style.cssText = vidroClaro + ';padding:4px 12px;border-radius:12px;white-space:nowrap;' +
    'opacity:0;transform:translateX(-8px);transition:opacity .5s,transform .5s';
  linha.append(botao, aviso);
  // as barrinhas
  const grupo = document.createElement('div');   // caixa única com todas as barrinhas, no meio da tela
  const fechado = 'translate(-50%, -50%) scale(.96)';
  grupo.style.cssText = vidroClaro + ';position:fixed;left:50%;top:50%;width:min(288px, calc(100vw - 32px));' +
    'box-sizing:border-box;padding:16px;border-radius:24px;display:flex;flex-direction:column;gap:12px;' +
    'touch-action:none;overscroll-behavior:contain;pointer-events:none;opacity:0;transform:' + fechado + ';transition:transform .4s cubic-bezier(.22,1,.36,1),opacity .4s';
  const barrinha = (nome, min, max, ler, gravar, mostrar) => {
    const caixa = document.createElement('label');
    caixa.style.cssText = 'display:grid;grid-template-columns:1fr auto;gap:4px 8px;align-items:center';
    const rotulo = document.createElement('span'); rotulo.textContent = nome;
    const valor = document.createElement('span');
    const barra = document.createElement('input');
    barra.type = 'range'; barra.min = min; barra.max = max; barra.step = '0.01'; barra.value = ler();
    barra.style.cssText = 'grid-column:1 / -1;width:100%;height:28px;margin:0;accent-color:#222';
    const atualizar = () => { valor.textContent = mostrar(); };
    barra.addEventListener('input', () => { gravar(parseFloat(barra.value)); atualizar(); });
    // arrasto próprio: o dedo em qualquer ponto da barrinha move o valor, e a
    // página embaixo não rola (touch-action:none na caixa)
    const porDedo = e => {
      const r = barra.getBoundingClientRect();
      const f = Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1);
      barra.value = min + (max - min) * f;
      gravar(parseFloat(barra.value)); atualizar();
    };
    barra.addEventListener('pointerdown', e => { e.preventDefault(); barra.setPointerCapture(e.pointerId); porDedo(e); });
    barra.addEventListener('pointermove', e => { if (barra.hasPointerCapture(e.pointerId)) porDedo(e); });
    atualizar();
    caixa.append(rotulo, valor, barra);
    grupo.append(caixa);
  };
  barrinha('Tamanho do anel', 0.8, 2.2, () => PERTO_VIAGEM, v => { PERTO_VIAGEM = v; }, () => Math.round(PERTO_VIAGEM * 100) + '%');
  // posição: para a direita na barrinha = símbolo mais alto na tela
  barrinha('Posição', 0.3, 0.7, () => 1 - CENTRO_TELA, v => { CENTRO_TELA = 1 - v; }, () => Math.round(CENTRO_TELA * 100) + '%');
  barrinha('Tamanho da pétala', 0.5, 2.5, () => CRESCER_PETALA, v => { CRESCER_PETALA = v; }, () => CRESCER_PETALA.toFixed(2) + 'x');
  barrinha('Giro da pétala', 0, 12, () => ROLAR, v => { ROLAR = v; }, () => ROLAR.toFixed(1));
  barrinha('Opacidade', 0, 1, () => OPACIDADE, v => { OPACIDADE = v; }, () => Math.round(OPACIDADE * 100) + '%');
  barrinha('Desfoque', 0, 20, () => DESFOQUE, v => { DESFOQUE = v; }, () => DESFOQUE.toFixed(1) + ' px');
  painel.append(linha, grupo);
  ['touchstart', 'touchmove', 'wheel'].forEach(ev => painel.addEventListener(ev, e => e.stopPropagation(), { passive: true }));
  // toque na caixa aberta: a tela embaixo não rola
  grupo.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
  grupo.addEventListener('wheel', e => e.preventDefault(), { passive: false });
  document.body.append(painel);
  // abre e fecha só pelo botão (rolar a página não mexe nelas)
  let aberto = false;
  const mostrarAviso = sim => { aviso.style.opacity = sim ? '1' : '0'; aviso.style.transform = sim ? 'none' : 'translateX(-8px)'; };
  botao.addEventListener('click', () => {
    aberto = !aberto;
    grupo.style.opacity = aberto ? '1' : '0';
    grupo.style.transform = aberto ? 'translate(-50%, -50%)' : fechado;
    grupo.style.pointerEvents = aberto ? 'auto' : 'none';
    seta.style.transform = aberto ? 'rotate(180deg)' : 'none';
    botao.setAttribute('aria-label', aberto ? 'Fechar ajustes' : 'Abrir ajustes');
    mostrarAviso(false);
  });
  // ao abrir a página: o aviso aparece ao lado da seta e some sozinho
  setTimeout(() => mostrarAviso(true), 1200);
  setTimeout(() => mostrarAviso(false), 6200);
}

let foraDaTela = false;
function desenhar(_, dtMs) {
  const dt = Math.min(dtMs / 1000, 0.05);
  t += reduzirMovimento ? dt * 0.2 : dt;

  // quanto o símbolo ocupa: encaixe na largura da coluna
  const visH = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const encaixe = Math.min(1, (visH * camera.aspect * 0.78) / DIAMETRO);

  const passoRodape = dt / RODAPE_DURACAO;
  rodapeAnda += Math.max(-passoRodape, Math.min(passoRodape, rodapeAlvo - rodapeAnda));
  const est = seguirComMola(estadoSimbolo(), dt);
  let k = est.amplitude, tipo = TRANSICOES[est.tipo];
  const prog = est.progresso;
  if (1 - abertura.valor > k) { k = 1 - abertura.valor; tipo = 'abertura'; }

  // viagem: o anel se abre além da altura da tela, sempre atrás do texto.
  // As pétalas dos lados saem da tela; ficam as de cima e de baixo, com o
  // texto no meio. Ao chegar, fecha de novo no topo da próxima seção.
  const planos = tipo === 'abertura' ? 0 : est.aberto;
  const escalaBase = encaixe * est.escala;
  const escalaPerto = Math.max(escalaBase, (visH * Math.min(1, innerHeight / alturaCanvas) * PERTO_VIAGEM) / DIAMETRO);   // pela área visível
  // o 3D fica grudado no topo da tela, mas no fim da página o palco acaba e
  // ele sobe um pouco: desconta onde ele está de fato
  const topoCanvas = canvas.getBoundingClientRect().top;
  giro.position.y = (1 - 2 * (est.sy - topoCanvas) / alturaCanvas) * visH * 0.5;   // segue a âncora na tela
  giro.position.x = (est.dx / larguraCanvas) * visH * camera.aspect;  // só sai do centro no rodapé
  // rodapé: é sempre o mesmo símbolo. Quase chegando, o vidro perde os
  // efeitos (refração, reflexos, arco-íris), achata, fica de frente e para de
  // balançar até ficar chapado na cor da marca, e assim continua girando ao
  // lado do nome. O nome surge saindo do desfoque enquanto ele chega.
  const fimOp = Math.min(est.fim || 0, 1);
  const opac = ((OPACIDADE + (1 - OPACIDADE) * fimOp) * (fimOp > 0 ? suave(fimOp / 0.35) : 1)).toFixed(3);   // no rodapé surge no lugar do logo e fica inteiro
  if (opac !== canvas._opac) { canvas._opac = opac; canvas.style.opacity = opac; }
  const desf = (DESFOQUE * (1 - Math.min(est.fim || 0, 1))).toFixed(1);          // logo do rodapé nítido
  if (desf !== canvas._desf) { canvas._desf = desf; canvas.style.filter = desf === '0.0' ? '' : `blur(${desf}px)`; }
  const chapado = suave((est.fim - 0.45) / 0.5);   // chapado ao chegar no meio
  vidro.uniforms.chapado.value = chapado;
  simbolo.scale.z = 1 - 0.9 * chapado;
  const nome = est.nome;   // o nome aparece enquanto o símbolo desliza para o lado
  const chave = nome.toFixed(3);
  if (chave !== chaveRodape) {
    chaveRodape = chave;
    nomeRodape.style.opacity = (0.85 * nome).toFixed(3);
    nomeRodape.style.filter = `invert(1) blur(${((1 - nome) * 2.5).toFixed(2)}px)`;   // desfoque leve, o fade faz o resto
    // slogan e ©: entram em foco junto com o nome (o © um pouquinho depois)
    textosRodape.forEach((el, i) => {
      // cascata rápida: começa logo depois do nome e cada linha vem 0,1 depois da anterior
      const v = reduzirMovimento ? 1 : suave((nome - 0.25 - i * 0.1) / 0.4);
      el.classList.toggle('focando', v < 1);
      el.style.setProperty('--foco', ((1 - v) * 4).toFixed(2));
      el.style.opacity = v.toFixed(3);
      el.style.transform = v < 1 ? `translateY(${((1 - v) * 8).toFixed(1)}px)` : '';
    });
  }
  // as pétalas crescem só um pouco; o que cresce mesmo é a distância entre elas
  const alem = est.alem || 0;   // 0 → 1: segue crescendo até sair da tela
  const escalaAnel = (escalaBase + (escalaPerto - escalaBase) * planos) * (1 + 3 * alem);   // tamanho do anel
  const escalaPetala = escalaBase * (1 + (Math.min(CRESCER_PETALA, escalaPerto / escalaBase) - 1) * planos) * (1 + 0.8 * alem);
  const afastar = escalaAnel / escalaPetala;                                       // ≥ 1
  giro.scale.setScalar(escalaPetala);
  ponteiro.ax += (ponteiro.y * 0.25 - ponteiro.ax) * 0.05;
  ponteiro.ay += (ponteiro.x * 0.35 - ponteiro.ay) * 0.05;
  giro.rotation.set((-0.12 + ponteiro.ax) * (1 - chapado), ponteiro.ay * (1 - chapado), 0);   // de frente no rodapé
  // giro contínuo + extra proporcional à velocidade com que ele abre ou fecha
  // (rolou rápido → abre rápido → gira rápido; parou → volta ao giro lento).
  // No lugar do rodapé, o giro de base desacelera.
  const dtT = reduzirMovimento ? dt * 0.2 : dt;
  if (dt > 0) {
    const ritmo = Math.min((Math.abs(planos - abertoAntes) + Math.abs(est.fim - fimAntes)) / dt, 3);   // sem pico quando fecha de uma vez no rodapé
    giroExtra += (GIRO_POR_ABERTURA * ritmo - giroExtra) * (1 - Math.exp(-dt * 6));
  }
  abertoAntes = planos; fimAntes = est.fim;
  // indo para o logo gira bem mais rápido (pico no meio do caminho)
  const indoProLogo = 0.9 * Math.sin(Math.PI * Math.min(est.fim, 1));
  const anguloAntes = anguloGiro;
  anguloGiro += dtT * (GIRO_BASE * (1 + 1.0 * planos) + giroExtra + indoProLogo);   // aberto gira um pouco mais
  simbolo.rotation.z = -anguloGiro;
  // pétalas no próprio eixo: giram enquanto aberto; fechando, terminam a volta
  // até ficar na posição original (sem salto)
  // rolam junto com o anel: a cambalhota segue o giro do círculo, todas no
  // mesmo sentido (mais o anel gira, mais elas rolam)
  giroPetalas += (anguloGiro - anguloAntes) * ROLAR * planos;
  const voltaInteira = Math.round(giroPetalas / (Math.PI * 2)) * Math.PI * 2;
  // fechando, ou com o giro em 0, terminam a volta e voltam à posição original
  const assentar = ROLAR < 0.05 ? 1 : 1 - planos;
  giroPetalas += (voltaInteira - giroPetalas) * assentar * (1 - Math.exp(-dt * 4));

  const volta = suave(prog) * Math.PI * 2;      // 0 → 360° ao longo da transição

  simbolo.children.forEach((petala, i) => {
    const u = petala.userData;
    let virar = 0;    // giro em torno do eixo comprido da pétala
    let torcer = 0;   // inclinação para fora/dentro
    pos.copy(u.base);
    if (tipo === 'abertura') {                 // abertura: chegam de fora e se juntam
      pos.multiplyScalar(1 + k * 2.6);
      pos.z += Math.sin(u.fase * 2.3) * k * 1.5;
      virar = k * 1.4;
    } else if (tipo === 'abrir-torcer') {      // cresce e cada pétala dá uma volta torcendo
      pos.multiplyScalar(1 + k * 0.45);
      virar = volta;
      torcer = k * 0.5;
    } else if (tipo === 'onda') {              // giro completo, uma pétala depois da outra
      pos.multiplyScalar(1 + k * 0.3);
      virar = suave((prog - i * 0.12) / 0.5) * Math.PI * 2;
    } else if (tipo === 'profundidade') {      // vêm para a frente dando uma cambalhota
      pos.multiplyScalar(1 + k * 0.35);
      pos.z += k * (1.6 + Math.sin(u.fase * 3) * 0.9);
      torcer = suave((prog - i * 0.06) / 0.76) * Math.PI * 2;
    } else if (tipo === 'espiral') {           // o anel dá uma volta completa abrindo e fechando
      const c = Math.cos(volta), s = Math.sin(volta);
      pos.set(u.base.x * c - u.base.y * s, u.base.x * s + u.base.y * c, u.base.z).multiplyScalar(1 + k * 0.5);
    }
    pos.x *= afastar; pos.y *= afastar;
    petala.position.copy(pos);
    petala.scale.setScalar(est.petala);
    // balanço contido (como no vídeo de referência) + o movimento da transição
    qA.setFromAxisAngle(u.radial, Math.sin(t * 0.45 + u.fase) * 0.42 * (1 - k) * (1 - chapado) + virar);
    qB.setFromAxisAngle(u.tangente, Math.sin(t * 0.32 + u.fase * 1.7) * 0.12 * (1 - chapado) + torcer);
    petala.quaternion.copy(qA).multiply(qB);
    // aberto: cada pétala também dá cambalhota no próprio centro, de
    // ponta-cabeça (eixo de lado, tangente ao anel), rolando junto com o giro
    // do círculo; ao fechar, termina a volta e assenta
    petala.quaternion.premultiply(qC.setFromAxisAngle(u.tangente, giroPetalas));
  });

  // fora da tela no corpo da página: não desenha (poupa o celular); limpa uma vez
  if (alem > 0.995 && !(est.fim > 0)) {
    if (!foraDaTela) { foraDaTela = true; renderer.setRenderTarget(null); renderer.setClearColor(0, 0); renderer.clear(); }
    return;
  }
  foraDaTela = false;
  // passo 1: faces de trás (normais, resolução cheia para as bordas ficarem lisas)
  // · passo 2: imagem final
  renderer.getDrawingBufferSize(tamanho);
  if (alvoCostas.width !== tamanho.x || alvoCostas.height !== tamanho.y) alvoCostas.setSize(tamanho.x, tamanho.y);
  scene.overrideMaterial = matCostas;
  renderer.setRenderTarget(alvoCostas); renderer.setClearColor(0, 0); renderer.clear();
  renderer.render(scene, camera);
  scene.overrideMaterial = null;
  renderer.setRenderTarget(null);
  renderer.render(scene, camera);
}


ajustarCanvas();

// zoom de pinça (visualViewport.scale): resolução acompanha o zoom, até 4x
let esperaZoom = 0;
window.visualViewport?.addEventListener('resize', () => {
  clearTimeout(esperaZoom);
  esperaZoom = setTimeout(() => {
    const zoom = Math.max(1, window.visualViewport.scale || 1);
    const novo = Math.min(DPR_BASE * zoom, DPR_TETO);
    if (Math.abs(novo - dpr) < 0.1) return;
    dpr = novo;
    renderer.setPixelRatio(dpr);
    renderer.setSize(larguraCanvas, alturaCanvas, false);
  }, 120);   // espera o gesto assentar para não redesenhar a cada movimento
});

addEventListener('pointermove', e => {
  if (e.pointerType !== 'mouse') return;   // no celular, tocar não inclina o símbolo
  const r = canvas.getBoundingClientRect();
  ponteiro.x = Math.max(-1, Math.min(1, (e.clientX - r.left) / r.width * 2 - 1));
  ponteiro.y = e.clientY / innerHeight * 2 - 1;
}, { passive: true });

// ---------------------------------------------------------------------------
// 4. ROLAGEM SUAVE
// ---------------------------------------------------------------------------
// computador: rolagem do mouse mais leve; celular como estava
const lenis = new Lenis(desktop.matches ? { lerp: 0.1, wheelMultiplier: 1 } : { lerp: 0.07, wheelMultiplier: 0.85 });
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add(time => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);
gsap.ticker.add(desenhar);
// faixa de baixo: some nos últimos 120 px da página (o rodapé fica à mostra)
const fadeBase = document.querySelector('.fade-base');
let fadeAntes = -1;
gsap.ticker.add(() => {
  const restante = document.documentElement.scrollHeight - innerHeight - scrollY;
  const v = Math.round(Math.min(Math.max(restante / 120, 0), 1) * 50) / 50;
  if (v !== fadeAntes) { fadeAntes = v; fadeBase.style.opacity = v; }
});

gsap.to(vidro.uniforms.revelar, { value: 1, duration: 1.6, ease: 'power2.out' });
gsap.to(abertura, { valor: 1, duration: 2.4, ease: 'expo.out', delay: 0.1 });

// re-medir quando o layout muda (largura, fontes carregadas, ScrollTrigger)
medir();
ScrollTrigger.addEventListener('refresh', medir);
document.fonts?.ready.then(() => ScrollTrigger.refresh());
let larguraAnterior = innerWidth;
addEventListener('resize', () => {
  if (innerWidth === larguraAnterior) return;     // ignora a barra do celular
  larguraAnterior = innerWidth;
  ScrollTrigger.refresh();
});
addEventListener('load', () => ScrollTrigger.refresh());

// ---------------------------------------------------------------------------
// 5. ENTRADAS E CARTÕES
// Linguagem única: foco no meio da tela, desfoque só nas bordas.
// Com "movimento reduzido" ligado no aparelho, tudo aparece direto.
// ---------------------------------------------------------------------------
const quando = (el, inicio = 'top 86%') => ({ trigger: el, start: inicio });

// entrar em foco: o desfoque some devagar no começo e no fim (sem "estalo"
// quando fica nítido); a opacidade chega antes, para não ver um borrão escuro
// O desfoque é a sombra da própria letra (classe .focando no CSS), não um
// filtro: o filtro vira uma "foto" do texto e, no fim, troca de uma vez pela
// letra nítida (a quebradinha). A sombra com raio 0 já é idêntica à letra.
function foco(alvos, { blur, dur = 2, delay = 0, stagger = 0, y = 0, st } = {}) {
  alvos = gsap.utils.toArray(alvos);
  alvos.forEach(a => { a.classList.add('focando'); a.style.setProperty('--foco', blur); });
  gsap.timeline({ delay, scrollTrigger: st })
    .to(alvos, { '--foco': 0, duration: dur, ease: 'sine.inOut',
      stagger: { each: stagger, onComplete() { this.targets()[0].classList.remove('focando'); } } }, 0)
    .fromTo(alvos, { opacity: 0, y },
      { opacity: 1, y: 0, duration: dur * 0.7, ease: 'power2.out', stagger,
        clearProps: y ? 'opacity,transform' : 'opacity' }, 0);
}

if (!reduzirMovimento) {
  // hero: ao abrir a página, título linha a linha e texto entram em foco
  foco(document.querySelectorAll('.hero .linha > span'), { blur: 12, dur: 1.5, stagger: 0.14, delay: 0.7 });
  foco('.hero-texto', { blur: 6, dur: 1.2, y: 14, delay: 1.2 });
  // fios que descem: o do hero aparece por último; os das seções quando a pessoa chega
  gsap.from('.hero .rolar', { opacity: 0, scaleY: 0, transformOrigin: '50% 0', duration: 1.2, ease: 'expo.out', delay: 1.8 });
  document.querySelectorAll('.secao .rolar').forEach(el => {
    gsap.from(el, { opacity: 0, scaleY: 0, transformOrigin: '50% 0',
      duration: desktop.matches ? 0.9 : 1.2, ease: desktop.matches ? 'power3.out' : 'expo.out',
      scrollTrigger: quando(el, 'top 95%') });
  });
  // e-mail: as linhas se desenham do centro e a seta dá um impulso
  const email = document.querySelector('.email');
  gsap.timeline({ scrollTrigger: quando(email, 'top 90%') })
    .fromTo(email, { '--traco': 0 }, { '--traco': 1, duration: 1.4, ease: 'expo.inOut' })
    .from(email.querySelector('svg'), { x: -12, y: 12, opacity: 0, duration: 1, ease: 'expo.out' }, 0.6);
  // rodapé: slogan e © surgem junto com o nome, no desenho de cada quadro

  // COMPUTADOR: cada seção entra em foco quando chega (título linha a linha,
  // depois rótulo e textos) e os cartões sobem um a um. No celular quem faz a
  // entrada é o efeito de profundidade, como antes.
  if (desktop.matches) {
    const entrar = (alvos, { blur, dur, stagger, y, atraso }, trigger) => {
      alvos = gsap.utils.toArray(alvos);
      if (!alvos.length) return;
      alvos.forEach(a => { a.classList.add('focando'); a.style.setProperty('--foco', blur); });
      gsap.set(alvos, { opacity: 0, y });
      gsap.timeline({ delay: atraso, scrollTrigger: { trigger, start: 'top 80%', once: true } })
        .to(alvos, { '--foco': 0, duration: dur, ease: 'power3.out',
          stagger: { each: stagger, onComplete() { const el = this.targets()[0]; el.classList.remove('focando'); el._entrou = true; } } }, 0)
        .to(alvos, { opacity: 1, y: 0, duration: dur * 0.6, ease: 'expo.out', stagger, clearProps: 'opacity,transform' }, 0);
    };
    ['#quem', '#atuacao', '#modelo', '#contato'].forEach(sel => {
      const sec = document.querySelector(sel);
      entrar(sec.querySelectorAll('.revela .linha > span'), { blur: 8, dur: 1.1, stagger: 0.08, y: 16, atraso: 0 }, sec);
      entrar(sec.querySelectorAll('.rotulo, .texto-coluna > p, .email'), { blur: 4, dur: 0.9, stagger: 0.1, y: 20, atraso: 0.15 }, sec);
    });
    gsap.utils.toArray('.cartao').forEach((c, i) => {
      gsap.from(c, { y: 40, opacity: 0, duration: 1, ease: 'expo.out', delay: 0.08 * i, clearProps: 'opacity,transform',
        scrollTrigger: { trigger: c, start: 'top 85%', once: true } });
    });
  }
}

// Profundidade: os textos ficam nítidos no meio da tela e só desfocam e
// somem (fade) nas faixas da borda de cima e de baixo, como fora de foco
// numa câmera. Segue a rolagem a cada quadro; fora das faixas não custa nada.
// (O hero entra pela animação de abertura e só depois passa a seguir isso.)
const FAIXA = 0.2, DESFOQUE_BORDA = 10;   // faixa = 20% da altura da tela em cima e embaixo
let profundos = [];
if (!reduzirMovimento) {
  const seletor = 'main .linha > span, main .rotulo, main .texto-coluna > p, main p.texto-coluna, ' +
    '.cartao h3, .cartao p, .email, .endereco';
  const todos = [...document.querySelectorAll(seletor)];
  todos.forEach(el => { el._preso = !!el.closest('.atuacao-topo'); el._cartao = !!el.closest('.cartao'); });
  profundos = todos.filter(el => !el.closest('.hero'));
  setTimeout(() => {
    profundos = todos.concat([...document.querySelectorAll('.hero-texto')]);
    profundos.forEach(el => { if (el.closest('.hero')) el._entrou = true; });   // o hero já entrou pela abertura
    rolagemAntes = -1;
  }, 3000);
  let rolagemAntes = -1, alturaAntes = 0;
  gsap.ticker.add(() => {
    // só recalcula quando a página rolou ou mudou de tamanho (parado não custa nada)
    if (scrollY === rolagemAntes && alturaCanvas === alturaAntes) return;
    rolagemAntes = scrollY; alturaAntes = alturaCanvas;
    // altura da tela de verdade: no iPhone a página aparece também atrás da
    // barra do Safari (abaixo de innerHeight); sem isso, o texto ali ficava
    // nítido e só desfocava ao subir
    // computador: faixa menor (12%), desfoque mais leve e só na borda de cima;
    // os cartões ficam sempre nítidos e cada texto só segue o efeito depois
    // que fez a sua entrada (senão os dois brigam)
    const pc = desktop.matches;
    const H = alturaTela || innerHeight, z = (pc ? 0.12 : FAIXA) * H;
    const valores = profundos.map(el => {          // primeiro só lê (sem forçar layout)
      if (pc && (el._cartao || !el._entrou)) return -1;
      const r = el.getBoundingClientRect();
      if (r.bottom < -z || r.top > H + z) return -1;   // bem longe da tela: deixa como está
      if (r.bottom < 0) return 1;                       // saiu por cima: desfocado
      if (r.top > H) return pc ? -1 : 1;                // abaixo da tela: no celular já desfocado ao entrar
      if (el._preso) return 0;   // título parado da Atuação (em cima ou ao lado dos cartões): sempre nítido
      // bloco alto (parágrafo): na faixa de cima vale a parte de baixo dele, na
      // de baixo vale a parte de cima — só desfoca quando quase todo ele está
      // na faixa (antes desfocava o parágrafo inteiro com metade ainda no meio)
      const meio = (r.top + r.bottom) / 2, folga = Math.max(0, r.height / 2 - 20);
      const emCima = meio + folga, emBaixo = meio - folga;
      const cima = suave((z - emCima) / z);
      return pc ? cima : Math.max(cima, suave((emBaixo - (H - z)) / z));
    });
    profundos.forEach((el, i) => {                 // depois escreve
      const v = valores[i];
      if (v < 0) return;
      const q = Math.round(v * 50) / 50;
      if (q === el._prof) return;
      el._prof = q;
      if (q === 0) { el.classList.remove('focando'); el.style.opacity = ''; return; }
      el.classList.add('focando');
      el.style.setProperty('--foco', (q * (desktop.matches ? 6 : DESFOQUE_BORDA)).toFixed(2));
      el.style.opacity = (1 - q).toFixed(3);   // some por completo na borda, junto com o desfoque
    });
  });
}


const cartoes = gsap.utils.toArray('.cartao');

// computador: o ponto de luz de cada cartão (dentro e na borda) vai até o lado
// do mouse com atraso suave e acende mais quanto mais perto ele está, mesmo
// com o mouse fora do cartão. Só com mouse de verdade; com "movimento
// reduzido" a luz fica parada (CSS) e no celular/toque nada roda.
const comMouse = matchMedia('(hover: hover) and (pointer: fine)');
if (!reduzirMovimento) {
  const ALCANCE = 520;   // px do cartão até onde a luz ainda acende
  const FOLGA = 60;      // o centro da luz fica no máximo a 60 px fora da borda
  const mouse = { x: 0, y: 0, dentro: false };
  const luzes = cartoes.map(() => ({ x: 0, y: 0, luz: 0, nova: true, escrito: '' }));
  addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    mouse.x = e.clientX; mouse.y = e.clientY; mouse.dentro = true;
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => { mouse.dentro = false; });
  gsap.ticker.add((_, dtMs) => {
    const ligado = desktop.matches && comMouse.matches && mouse.dentro;
    if (!ligado && luzes.every(l => l.luz === 0)) return;   // apagado: não custa nada
    const dt = Math.min(dtMs / 1000, 0.05);
    const segue = 1 - Math.exp(-dt * 5);   // posição: atraso suave
    const acende = 1 - Math.exp(-dt * 4);  // intensidade: liga e apaga devagar
    const H = innerHeight;
    // primeiro só lê (posição dos cartões), depois escreve
    const rects = cartoes.map(c => c.getBoundingClientRect());
    const larguras = cartoes.map(c => c.offsetWidth);
    rects.forEach((r, i) => {
      const l = luzes[i];
      const visivel = r.bottom > 0 && r.top < H;
      if (!visivel && l.luz < 0.002) return;
      // alvo: o ponto do cartão mais perto do mouse (ou o próprio mouse, dentro),
      // em px do próprio cartão (desconta o recuo da pilha, que o encolhe)
      const s = r.width / larguras[i] || 1;
      const ax = Math.min(Math.max((mouse.x - r.left) / s, -FOLGA), r.width / s + FOLGA);
      const ay = Math.min(Math.max((mouse.y - r.top) / s, -FOLGA), r.height / s + FOLGA);
      const dx = Math.max(r.left - mouse.x, 0, mouse.x - r.right);
      const dy = Math.max(r.top - mouse.y, 0, mouse.y - r.bottom);
      const alvo = ligado ? (1 - Math.min(Math.hypot(dx, dy) / ALCANCE, 1)) ** 2 : 0;   // cai rápido perto e some macio longe
      if (l.nova) { l.x = ax; l.y = ay; l.nova = false; }   // a primeira vez nasce no lugar certo
      l.x += (ax - l.x) * segue;
      l.y += (ay - l.y) * segue;
      l.luz += (alvo - l.luz) * acende;
      if (l.luz < 0.002 && alvo === 0) l.luz = 0;
      const escrito = `${l.x.toFixed(1)}|${l.y.toFixed(1)}|${l.luz.toFixed(3)}`;
      if (escrito === l.escrito) return;
      l.escrito = escrito;
      const c = cartoes[i];
      c.style.setProperty('--mx', l.x.toFixed(1) + 'px');
      c.style.setProperty('--my', l.y.toFixed(1) + 'px');
      c.style.setProperty('--luz', l.luz.toFixed(3));
    });
  });
}

// a cada quadro, celular e computador:
// - o ponto de brilho corre pela borda conforme o cartão anda na tela (só o
//   celular desenha esse brilho)
// - pilha em degraus: quem fica embaixo recua a cada cartão que chega por cima
//   (celular 88%, 94% e 100%; computador só 96%, 98% e 100%, para todo texto
//   seguir legível). Usa a propriedade "scale", separada do transform das entradas.
gsap.ticker.add(() => {
  const H = innerHeight;
  const recuo = desktop.matches ? 0.02 : 0.06;
  // só trabalha enquanto a seção dos cartões está perto da tela
  const [ini, fim] = medidas.atuacao;
  if (scrollY + H < ini - 200 || scrollY > fim + 200) return;
  const chegou = cartoes.map((c, i) => {
    const r = c.getBoundingClientRect();
    if (r.bottom > -50 && r.top < H + 50) c.style.setProperty('--ang', (160 + (r.top / H) * 220 + i * 40).toFixed(1) + 'deg');
    return suave((H * 0.9 - r.top) / Math.max(H * 0.9 - medidas.cartoes[i], 1));
  });
  cartoes.forEach((c, i) => {
    let empilhados = 0;
    for (let j = i + 1; j < cartoes.length; j++) empilhados += chegou[j];
    c.style.scale = (1 - recuo * empilhados).toFixed(4);
    c.style.setProperty('--escurece', (0.1 * empilhados).toFixed(3));
  });
});

// ---------------------------------------------------------------------------
// 6. TEMA, BOTÃO DE SUBIR, TOPO E MENU
// ---------------------------------------------------------------------------
const metaTema = document.querySelector('meta[name="theme-color"]');
function aplicarTema(tema, { salvar = false, instantaneo = false } = {}) {
  document.documentElement.dataset.tema = tema;
  const cor = FUNDOS[tema];
  gsap.to(FUNDO, { r: cor.r, g: cor.g, b: cor.b, duration: instantaneo ? 0 : 0.6, ease: 'power2.out' });
  vidro.uniforms.envMap.value = estudioDoTema(tema).limpo;
  vidro.uniforms.envEspelho.value = estudioDoTema(tema).espelho;
  vidro.uniforms.tom.value = tema === 'escuro' ? 0 : 0.7;
  vidro.uniforms.luzForca.value = tema === 'escuro' ? 1.0 : 0.8;
  metaTema?.setAttribute('content', tema === 'escuro' ? '#070708' : '#f3f3f1');
  if (salvar) { try { localStorage.setItem('stellium-tema', tema); } catch (e) { /* sem armazenamento */ } }
}
aplicarTema('claro', { instantaneo: true });   // o site é sempre claro (o escuro ficou guardado no código)

// botão voltar ao topo (aparece depois do hero) e topo que some ao descer
const subir = document.querySelector('.subir');
const topo = document.querySelector('.topo');
let ultimaRolagem = 0;
addEventListener('scroll', () => {
  const y = scrollY;
  subir.classList.toggle('visivel', y > innerHeight * 0.9);
  const delta = y - ultimaRolagem;
  if (Math.abs(delta) < 4) return;            // ignora tremidinhas
  topo.classList.toggle('escondido', delta > 0 && y > 120 && !document.body.classList.contains('menu-aberto'));
  ultimaRolagem = y;
}, { passive: true });
// os espaços do símbolo abrem no caminho e empurram o destino um pouco:
// ao chegar, um ajuste curto acerta a posição
const rolarAte = alvo => lenis.scrollTo(alvo, { duration: 1.8, easing: x => 1 - Math.pow(1 - x, 4),
  onComplete: () => { if (alvo !== 0) lenis.scrollTo(alvo, { duration: 0.6, easing: x => 1 - Math.pow(1 - x, 3) }); } });
subir.addEventListener('click', () => rolarAte(0));

// menu em tela cheia
const botaoMenu = document.querySelector('.topo-menu');
const menu = document.getElementById('menu');
function abrirMenu(abrir) {
  document.body.classList.toggle('menu-aberto', abrir);
  if (abrir) topo.classList.remove('escondido');   // "Fechar" sempre visível
  botaoMenu.setAttribute('aria-expanded', abrir);
  menu.setAttribute('aria-hidden', !abrir);
  botaoMenu.setAttribute('aria-label', idioma.texto(abrir ? 'menu-fechar' : 'menu-abrir'));
  abrir ? lenis.stop() : lenis.start();
}
botaoMenu.addEventListener('click', () => abrirMenu(!document.body.classList.contains('menu-aberto')));
botaoMenu.setAttribute('aria-label', idioma.texto('menu-abrir'));

// PT / EN: os textos desfocam, trocam e voltam ao foco; depois tudo é re-medido
// (as alturas mudam com a outra língua, e o símbolo se guia por elas)
const textos = ['main', '.rodape', '.menu-lista'];
document.querySelector('.topo-idioma').addEventListener('click', () => {
  const nova = idioma.atual() === 'en' ? 'pt' : 'en';
  idioma.salvar(nova);
  const aberto = document.body.classList.contains('menu-aberto');
  gsap.timeline()
    .to(textos, { opacity: 0, filter: 'blur(8px)', duration: 0.3, ease: 'power2.in' })
    .add(() => {
      idioma.aplicar(nova);
      botaoMenu.setAttribute('aria-label', idioma.texto(aberto ? 'menu-fechar' : 'menu-abrir'));
      ScrollTrigger.refresh();
    })
    .to(textos, { opacity: 1, filter: 'blur(0px)', duration: 0.6, ease: 'power2.out', clearProps: 'filter,opacity' });
});
document.querySelectorAll('[data-ir]').forEach(a => a.addEventListener('click', e => {
  e.preventDefault();
  abrirMenu(false);
  rolarAte(a.dataset.ir);
}));

// ---------------------------------------------------------------------------
// Medidor de fluidez (diagnóstico): só aparece com #fps no fim do endereço.
// Mostra quadros por segundo, a resolução interna do 3D e se está numa moldura.
// ---------------------------------------------------------------------------
if (location.hash === '#fps') {
  const painel = document.createElement('div');
  painel.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:99;padding:6px 10px;border-radius:8px;' +
    'font:500 12px/16px ui-monospace,monospace;background:rgba(0,0,0,.75);color:#fff;pointer-events:none';
  document.body.append(painel);
  let quadros = 0, inicio = performance.now(), pior = 0, anterior = performance.now();
  gsap.ticker.add(() => {
    const agora = performance.now();
    pior = Math.max(pior, agora - anterior); anterior = agora;
    quadros++;
    if (agora - inicio >= 1000) {
      const moldura = window.self !== window.top ? 'sim' : 'não';
      painel.textContent = `${Math.round(quadros * 1000 / (agora - inicio))} qps · pior ${Math.round(pior)} ms · res ${dpr.toFixed(2)} · moldura ${moldura}`;
      quadros = 0; inicio = agora; pior = 0;
    }
  });
}
