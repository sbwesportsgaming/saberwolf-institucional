export const trustedAuth = {
  "authUrl": "https://kdcyyvsbntreyjeecfri.supabase.co",
  "authKey": "sb_publishable_fgrQNsahBGkwi7_zyMZumA_1XN8wBd6",
  "origins": [
    "https://sbwproject.com",
    "https://www.sbwproject.com"
  ]
};
export const groupConfig = {
 ...trustedAuth, publicKey: trustedAuth.authKey, bridgeOrigin: "https://sbwproject.com",
 sites: [
  {site:"saberwolf-esports",label:"SaberWolf Esports",origin:"https://sbwgg.com.br",kind:"remote",endpoint:"https://junuqclcrqrjxyxmfntk.supabase.co/functions/v1/sbw-project-access-source",publicKey:"sb_publishable_0pZzBW9QvcDPkD4bnNycUQ_BwK9KBpR"},
  {site:"sbw-championship",label:"SBW Championship",origin:"https://sbwchampionship.com",kind:"local",publicKey:trustedAuth.authKey}
 ]
};
export const sourceConfig = {...trustedAuth,site:"saberwolf-esports",projectUrl:"https://junuqclcrqrjxyxmfntk.supabase.co",publicKey:"sb_publishable_0pZzBW9QvcDPkD4bnNycUQ_BwK9KBpR"};
