(function () {
  "use strict";

  const scriptElement =
    document.currentScript ||
    Array.from(document.scripts).find((script) =>
      /\/js\/links\/links-config\.js(?:[?#]|$)/i.test(script.src)
    );

  // Este arquivo fica em js/links/, dois níveis abaixo da pasta do site.
  const SITE_BASE_URL = scriptElement?.src
    ? new URL("../../", scriptElement.src)
    : new URL(
        window.SBWRoutes?.getBasePath?.() || "../",
        document.baseURI || window.location.href
      );

  function siteUrl(path) {
    if (typeof window.SBWRoutes?.url === "function") {
      return window.SBWRoutes.url(path);
    }

    const cleanPath = String(path || "index.html").replace(/^\/+/, "");
    const url = new URL(cleanPath, SITE_BASE_URL);

    if (url.protocol === "file:") return url.href;

    return url.pathname + url.search + url.hash;
  }

  // A porta local e o domínio da Championship são definidos em sbw-routes.js.
  const championshipHomeUrl =
    window.SBWRoutes?.championship?.("/") || "";

  const championshipRankingsUrl =
    window.SBWRoutes?.championship?.("/rankings/rankings.html") || "";

  window.SBWLinksProfiles = Object.freeze({
    ecosystem: {
      theme: "ecosystem",
      eyebrow: "Links oficiais",
      title: "SaberWolf Esports",
      handle: "-SBW- · Organização de esports",
      description: "Esports, atletas, creators, comunidade e projetos oficiais da -SBW-.",
      image: siteUrl("assets/icons/icon-192-v3.png"),
      imageAlt: "Logo da SaberWolf Esports — -SBW-",

      links: [
        {
          id: "platform",
          label: "Acessar o site da SaberWolf",
          description: "A casa oficial da organização",
          href: siteUrl("index.html"),
          mark: "-SBW-",
          primary: true
        },
        {
          id: "tournaments",
          label: "SBW Championship",
          description: "Plataforma independente de torneios e eventos",
          href: championshipHomeUrl,
          mark: "VS",
          external: true,
          disabled: !championshipHomeUrl
        },
        {
          id: "rankings",
          label: "Rankings do Championship",
          description: "Histórico e desempenho na plataforma competitiva",
          href: championshipRankingsUrl,
          mark: "#",
          external: true,
          disabled: !championshipRankingsUrl
        },
        {
          id: "communities",
          label: "Comunidades",
          description: "Projetos e cenas conectadas à -SBW-",
          href: siteUrl("comunidades/comunidades.html"),
          mark: "CO"
        },
        {
          id: "news",
          label: "Notícias",
          description: "Atualizações da SaberWolf Esports",
          href: siteUrl("blog/noticias.html"),
          mark: "N"
        },
        {
          id: "creators",
          label: "Creators",
          description: "Conteúdo, lives e representantes oficiais",
          href: siteUrl("creators/creators.html"),
          mark: "CR"
        },
        {
          id: "athletes",
          label: "Atletas -SBW-",
          description: "Conheça os competidores da SaberWolf Esports",
          href: siteUrl("atletas/atletas-sbw.html"),
          mark: "AT"
        },
        {
          id: "store",
          label: "Loja -SBW-",
          description: "Produtos, coleções e novidades da organização",
          href: siteUrl("pages/loja.html"),
          mark: "SHOP"
        },
        {
          id: "instagram",
          label: "Instagram oficial",
          description: "@saberwolfesports",
          href: "https://www.instagram.com/saberwolfesports/",
          mark: "IG",
          external: true
        }
      ],

      related: {
        eyebrow: "Fundador e creator",
        title: "D’Lucca",
        description: "Lives, vídeos e redes pessoais.",
        href: "https://sbwproject.com/dlucca/",
        external: true,
        track: "links_ecosystem_dlucca"
      }
    },

    dlucca: {
      theme: "creator",
      eyebrow: "Creator · fundador da -SBW-",
      title: "D’Lucca",
      handle: "@dlucca_sbw",
      description: "Jogos de luta, desafios competitivos e muita resenha. Um espaço para jogar, aprender e fortalecer a comunidade.",
      image: siteUrl("assets/images/dlucca-avatar.jpeg"),
      imageAlt: "Retrato de D’Lucca",

      links: [
        {
          id: "twitch",
          label: "Ao vivo na Twitch",
          description: "Lives, gameplay e resenha com a comunidade",
          href: "https://www.twitch.tv/dlucca_sbw",
          mark: "LIVE",
          primary: true,
          external: true
        },
        {
          id: "youtube",
          label: "YouTube",
          description: "Vídeos, transmissões e projetos",
          href: "https://www.youtube.com/@dlucca_sbw",
          mark: "YT",
          external: true
        },
        {
          id: "instagram",
          label: "Instagram",
          description: "Bastidores e atualizações",
          href: "https://www.instagram.com/dlucca_sbw",
          mark: "IG",
          external: true
        },
        {
          id: "tiktok",
          label: "TikTok",
          description: "Clipes, highlights e conteúdo curto",
          href: "https://www.tiktok.com/@dlucca_sbw",
          mark: "TT",
          external: true
        },
        {
          id: "x",
          label: "X",
          description: "Publicações e comunicação rápida",
          href: "https://x.com/DLucca_SBW",
          mark: "X",
          external: true
        }
      ],

      related: {
        eyebrow: "Organização oficial",
        title: "Conheça a SaberWolf Esports",
        description: "Organização, creators, atletas e comunidades.",
        href: siteUrl("links/index.html"),
        track: "links_dlucca_ecosystem"
      }
    }
  });
})();