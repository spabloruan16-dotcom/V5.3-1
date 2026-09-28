/* ================================================================
   MODA CENTER — LIVE E VÍDEOS (VISÃO DO CLIENTE)
   ---------------------------------------------------------------
   - Lista as lives ativas (WebRTC) e os vídeos publicados pelas lojas.
   - Ao assistir uma live, entra como "viewer" e faz a sinalização
     WebRTC com o comerciante (mesmo protocolo usado em
     Comerciante/js/modacenterliveandvideo.js).
   - Todo erro de rede é tratado e exibido como mensagem amigável —
     nunca deixamos o JSON de erro do servidor aparecer na tela.
================================================================ */

const SESSION_KEY = "modaCenterSession";
const API_ENABLED = window.location.protocol !== "file:";

const session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
if (!session || session.profile !== "cliente") {
    window.location.href = "../../index.html?login=1";
}

document.getElementById("clientGreeting").textContent = `Olá, ${session?.name || "cliente"}. Veja quem está ao vivo agora.`;

document.getElementById("clientLogout").addEventListener("click", () => {
    localStorage.removeItem(SESSION_KEY);
    window.location.href = "../../index.html?login=1";
});

const noteElement = document.getElementById("liveVideosNote");
const livesGrid = document.getElementById("livesGrid");
const videosGrid = document.getElementById("videosGrid");
const tabLives = document.getElementById("tabLives");
const tabVideos = document.getElementById("tabVideos");

function escapeHtml(value) {
    return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

/**
 * Faz uma chamada à API sempre tratando o corpo como JSON e nunca
 * deixando um erro "estourar" como texto cru na tela do usuário.
 */
async function api(path, options = {}) {
    const response = await fetch(path, { cache: "no-store", ...options });
    let data = {};
    try { data = await response.json(); } catch (_) { /* resposta sem corpo JSON */ }
    if (!response.ok) throw new Error(data.error || "Não foi possível concluir a operação.");
    return data;
}

/* ----------------------------------------------------------------
   ABAS
---------------------------------------------------------------- */
function mostrarAba(aba) {
    const ehLive = aba === "lives";
    tabLives.classList.toggle("ativa", ehLive);
    tabLives.setAttribute("aria-selected", String(ehLive));
    tabVideos.classList.toggle("ativa", !ehLive);
    tabVideos.setAttribute("aria-selected", String(!ehLive));
    livesGrid.hidden = !ehLive;
    videosGrid.hidden = ehLive;
}
tabLives.addEventListener("click", () => mostrarAba("lives"));
tabVideos.addEventListener("click", () => mostrarAba("videos"));

/* ----------------------------------------------------------------
   CARREGAR LIVES
---------------------------------------------------------------- */
async function carregarLives() {
    if (!API_ENABLED) { livesGrid.innerHTML = `<div class="empty-state">Abra o site pelo servidor para ver as lives.</div>`; return; }
    try {
        const data = await api("/api/live");
        renderLives(Array.isArray(data.lives) ? data.lives : []);
    } catch (error) {
        livesGrid.innerHTML = `<div class="empty-state">Não foi possível carregar as lives agora. Tente novamente em instantes.</div>`;
    }
}

function renderLives(lives) {
    if (!lives.length) {
        livesGrid.innerHTML = `<div class="empty-state">Nenhuma loja está ao vivo no momento. Volte mais tarde!</div>`;
        return;
    }
    livesGrid.innerHTML = lives.map(live => `
        <button type="button" class="lv-card" data-live-id="${escapeHtml(live.id)}">
            <div class="lv-card-thumb">
                <span class="lv-card-badge">🔴 AO VIVO</span>
                <span class="lv-card-viewers">${Number(live.viewers || 0)} assistindo</span>
                ${live.cover ? `<img src="${escapeHtml(live.cover)}" alt="Capa da live">` : `<span class="lv-card-play">▶</span>`}
            </div>
            <div class="lv-card-body">
                <strong>${escapeHtml(live.title)}</strong>
                <p class="store-name">${escapeHtml(live.ownerName || "Loja Moda Center")}</p>
                <p>${escapeHtml(live.description || "")}</p>
            </div>
        </button>
    `).join("");
    livesGrid.querySelectorAll(".lv-card").forEach(card => {
        card.addEventListener("click", () => {
            const live = lives.find(item => String(item.id) === card.dataset.liveId);
            if (live) assistirLive(live);
        });
    });
}

/* ----------------------------------------------------------------
   CARREGAR VÍDEOS
---------------------------------------------------------------- */
async function carregarVideos() {
    if (!API_ENABLED) { videosGrid.innerHTML = `<div class="empty-state">Abra o site pelo servidor para ver os vídeos.</div>`; return; }
    try {
        const data = await api("/api/videos");
        renderVideos(Array.isArray(data.videos) ? data.videos : []);
    } catch (error) {
        videosGrid.innerHTML = `<div class="empty-state">Não foi possível carregar os vídeos agora. Tente novamente em instantes.</div>`;
    }
}

function renderVideos(videos) {
    if (!videos.length) {
        videosGrid.innerHTML = `<div class="empty-state">Nenhum vídeo publicado ainda.</div>`;
        return;
    }
    videosGrid.innerHTML = videos.map(video => `
        <button type="button" class="lv-card" data-video-id="${escapeHtml(video.id)}">
            <div class="lv-card-thumb">
                <span class="lv-card-badge lv-badge-video">🎬 VÍDEO</span>
                ${video.capa ? `<img src="${escapeHtml(video.capa)}" alt="Capa do vídeo">` : `<video src="${escapeHtml(video.url || video.videoUrl || "")}#t=0.5" preload="metadata" muted playsinline></video><span class="lv-card-play">▶</span>`}
            </div>
            <div class="lv-card-body">
                <strong>${escapeHtml(video.title || video.titulo)}</strong>
                <p class="store-name">${escapeHtml(video.ownerName || "Loja Moda Center")}</p>
                <p>${escapeHtml(video.description || video.descricao || "")}</p>
            </div>
        </button>
    `).join("");
    videosGrid.querySelectorAll(".lv-card").forEach(card => {
        card.addEventListener("click", () => {
            const video = videos.find(item => String(item.id) === card.dataset.videoId);
            if (video) assistirVideo(video);
        });
    });
}

/* ----------------------------------------------------------------
   ASSISTIR VÍDEO (arquivo já publicado)
---------------------------------------------------------------- */
const videoWatchModal = document.getElementById("videoWatchModal");
const videoWatchVideo = document.getElementById("videoWatchVideo");

function assistirVideo(video) {
    document.getElementById("videoWatchTitle").textContent = video.title || video.titulo || "Vídeo";
    document.getElementById("videoWatchStore").textContent = video.ownerName || "Loja Moda Center";
    document.getElementById("videoWatchDescription").textContent = video.description || video.descricao || "";
    videoWatchVideo.src = video.url || video.videoUrl || "";
    videoWatchModal.hidden = false;
    videoWatchVideo.play().catch(() => {});
}

function fecharVideoWatch() {
    videoWatchVideo.pause();
    videoWatchVideo.removeAttribute("src");
    videoWatchVideo.load();
    videoWatchModal.hidden = true;
}
document.getElementById("closeVideoWatch").addEventListener("click", fecharVideoWatch);

/* ----------------------------------------------------------------
   ASSISTIR LIVE (visualizador WebRTC)
   Mesmo protocolo de sinalização usado pelo comerciante:
   /api/live/:id/join, /api/live/:id/signal, /api/live/:id/signals,
   /api/live/:id/leave.
---------------------------------------------------------------- */
const liveWatchModal = document.getElementById("liveWatchModal");
const liveWatchVideo = document.getElementById("liveWatchVideo");
const liveWatchStatus = document.getElementById("liveWatchStatus");

let viewerState = null;
let viewerPc = null;
let viewerPollTimer = null;
let viewerPolling = false;
let viewerPendingIce = [];

function mostrarStatusLive(mensagem) {
    if (!mensagem) { liveWatchStatus.hidden = true; return; }
    liveWatchStatus.hidden = false;
    liveWatchStatus.textContent = mensagem;
}

async function assistirLive(live) {
    document.getElementById("liveWatchTitle").textContent = live.title;
    document.getElementById("liveWatchStore").textContent = live.ownerName || "Loja Moda Center";
    document.getElementById("liveWatchDescription").textContent = live.description || "";
    liveWatchVideo.srcObject = null;
    liveWatchModal.hidden = false;
    mostrarStatusLive("Conectando à transmissão...");

    try {
        const data = await api(`/api/live/${encodeURIComponent(live.id)}/join`, { method: "POST" });
        viewerState = { liveId: live.id, peerId: data.peerId, broadcasterPeerId: data.broadcasterPeerId };
        viewerPollTimer = setInterval(pollSignals, 900);
        await pollSignals();
    } catch (error) {
        mostrarStatusLive(error.message || "Essa live não está mais disponível.");
    }
}

async function pollSignals() {
    /* Evita polls sobrepostos: senão um candidato ICE podia ser processado antes da oferta. */
    if (!viewerState || viewerPolling) return;
    viewerPolling = true;
    try {
        const data = await api(`/api/live/${encodeURIComponent(viewerState.liveId)}/signals?peerId=${encodeURIComponent(viewerState.peerId)}`);
        for (const signal of (data.signals || [])) await handleSignal(signal);
    } catch (error) {
        mostrarStatusLive("A transmissão foi encerrada.");
        pararAssistirLive(false);
    } finally {
        viewerPolling = false;
    }
}

async function handleSignal(signal) {
    if (!viewerState || signal.from !== viewerState.broadcasterPeerId) return;

    if (signal.type === "offer") {
        viewerPc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
        viewerPc.ontrack = event => {
            liveWatchVideo.srcObject = event.streams[0];
            mostrarStatusLive(null);
            /* Navegadores podem bloquear áudio automático: tenta com som e, se bloquear, entra mudo. */
            liveWatchVideo.play().catch(() => { liveWatchVideo.muted = true; liveWatchVideo.play().catch(() => {}); mostrarStatusLive(null); });
        };
        viewerPc.onicecandidate = event => { if (event.candidate) enviarSinal("ice", event.candidate); };
        viewerPc.onconnectionstatechange = () => {
            if (viewerPc && ["failed", "closed", "disconnected"].includes(viewerPc.connectionState)) {
                mostrarStatusLive("A conexão com a transmissão caiu.");
            }
        };
        try {
            await viewerPc.setRemoteDescription(new RTCSessionDescription(signal.data));
            for (const candidate of viewerPendingIce) { try { await viewerPc.addIceCandidate(new RTCIceCandidate(candidate)); } catch (_) {} }
            viewerPendingIce = [];
            const answer = await viewerPc.createAnswer();
            await viewerPc.setLocalDescription(answer);
            await enviarSinal("answer", answer);
        } catch (_) { mostrarStatusLive("Não foi possível conectar à transmissão."); }
    }

    if (signal.type === "ice" && signal.data) {
        if (!viewerPc || !viewerPc.remoteDescription) { viewerPendingIce.push(signal.data); return; }
        try { await viewerPc.addIceCandidate(new RTCIceCandidate(signal.data)); } catch (_) { /* ignora candidato inválido */ }
    }
}

async function enviarSinal(type, data) {
    if (!viewerState) return;
    try {
        await api(`/api/live/${encodeURIComponent(viewerState.liveId)}/signal`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ from: viewerState.peerId, to: viewerState.broadcasterPeerId, type, data })
        });
    } catch (_) { /* sinal perdido: o próximo polling tenta de novo */ }
}

function pararAssistirLive(avisarServidor = true) {
    clearInterval(viewerPollTimer);
    viewerPollTimer = null;
    if (viewerPc) { viewerPc.close(); viewerPc = null; }
    viewerPendingIce = [];
    liveWatchVideo.muted = false;
    liveWatchVideo.srcObject = null;
    if (viewerState && avisarServidor) {
        api(`/api/live/${encodeURIComponent(viewerState.liveId)}/leave`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ peerId: viewerState.peerId })
        }).catch(() => {});
    }
    viewerState = null;
}

document.getElementById("closeLiveWatch").addEventListener("click", () => {
    pararAssistirLive(true);
    liveWatchModal.hidden = true;
});

window.addEventListener("pagehide", () => {
    if (!viewerState) return;
    try { navigator.sendBeacon(`/api/live/${encodeURIComponent(viewerState.liveId)}/leave`, new Blob([JSON.stringify({ peerId: viewerState.peerId })], { type: "application/json" })); } catch (_) {}
});

/* ----------------------------------------------------------------
   INICIALIZAÇÃO
---------------------------------------------------------------- */
carregarLives();
carregarVideos();
if (API_ENABLED) window.setInterval(() => { if (!liveWatchModal.hidden) return; carregarLives(); }, 6000);
if (API_ENABLED) window.setInterval(() => { if (!videoWatchModal.hidden) return; carregarVideos(); }, 15000);
