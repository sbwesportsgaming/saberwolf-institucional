(function () {
  "use strict";

  window.SBWLinksProfiles = Object.freeze({
    ecosystem: {
      theme: "ecosystem",
      eyebrow: "Links oficiais",
      title: "SaberWolf",
      handle: "-SBW- · Ecossistema gamer",
      description: "Competição, conteúdo e comunidade conectados em um só lugar.",
      image: "/assets/images/logo-sbw.png",
      imageAlt: "Identidade visual da -SBW-",
      links: [
        {
          id: "platform",
          label: "Acessar a plataforma -SBW-",
          description: "A central do ecossistema SaberWolf",
          href: "/",
          mark: "-SBW-",
          primary: true
        },
        {
          id: "tournaments",
          label: "Torneios",
          description: "Competições, inscrições e resultados",
          href: "/torneios/torneios.html",
          mark: "VS"
        },
        {
          id: "rankings",
          label: "Rankings",
          description: "Histórico e desempenho competitivo",
          href: "/rankings/rankings.html",
          mark: "#"
        },
        {
          id: "communities",
          label: "Comunidades",
          description: "Projetos e cenas conectadas à -SBW-",
          href: "/comunidades/comunidades.html",
          mark: "CO"
        },
        {
          id: "news",
          label: "Notícias",
          description: "Atualizações do ecossistema",
          href: "/blog/noticias.html",
          mark: "N"
        },
        {
          id: "creators",
          label: "Creators",
          description: "Conteúdo, lives e representantes oficiais",
          href: "/creators/creators.html",
          mark: "CR"
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
        href: "/links/dlucca/",
        track: "links_ecosystem_dlucca"
      }
    },

    dlucca: {
      theme: "creator",
      eyebrow: "Creator · fundador da -SBW-",
      title: "D’Lucca",
      handle: "@dlucca_sbw",
      description: "Jogos de luta, desafios competitivos e muita resenha. Um espaço para jogar, aprender e fortalecer a comunidade.",
      image: "/assets/images/dlucca-avatar.jpeg",
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
        eyebrow: "Projeto oficial",
        title: "Conheça o ecossistema -SBW-",
        description: "Torneios, rankings, creators e comunidades.",
        href: "/links/",
        track: "links_dlucca_ecosystem"
      }
    }
  });
})();
