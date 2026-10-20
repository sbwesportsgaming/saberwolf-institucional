# Aparência: Claro, Escuro e Automático

O seletor mantém a escolha em `localStorage` na chave `sbw-theme-v1`.
A preferência inicial é Automático, que acompanha `prefers-color-scheme`.
Cada domínio mantém sua própria escolha. Com armazenamento bloqueado, a troca
continua funcionando durante a visita. Não altera autenticação nem dados.

- Controle e aplicação antes da primeira pintura: `js/core/sbw-theme.js`.
- Paletas, contraste e exceções de marca: `css/core/sbw-theme.css`.
- Adaptadores de cores: `css/themes/dark/`.
- Estilos de origem continuam responsáveis por layout, imagens e modo claro.

## Manutenção

Ao alterar cores em um CSS de origem ou em um `<style>` da página, regenere
os adaptadores a partir da raiz do repositório:

```sh
npm --prefix tools/theme ci --ignore-scripts
npm --prefix tools/theme run build
```

O gerador usa PostCSS apenas no desenvolvimento. O site publicado não precisa
Node, npm ou processo de build. O gerador não altera arquivos CSS de origem,
URLs de imagens, scripts de negócio nem regras do banco.

Revise o diff e o contraste nos dois temas, inclusive estados de foco, hover,
alertas e campos de formulário. Exceções de contraste ficam no CSS comum;
cores de identidade em imagens e variáveis de equipes permanecem preservadas.

Em uma página nova, siga a ordem de imports de uma página equivalente:
script de tema síncrono no início do `head` com o mesmo `data-sbw-theme-site`,
adaptador imediatamente depois de cada CSS de origem e CSS comum no fim
do `head`. Ajuste os caminhos relativos conforme a pasta da página. Para
estilos inline, copie também o bloco `data-sbw-theme-inline` e regenere.

A tela offline incorpora o controle e a paleta no próprio HTML para continuar
funcionando sem rede. O gerador também sincroniza essas cópias. Ao publicar
novas versões da tela offline, incremente a versão do cache do service worker.

Ao atualizar arquivos de tema, incremente o parâmetro `v` dos imports nas
páginas alteradas para que o navegador solicite a nova versão.

## Conferência de uso

1. Trocar Claro → Escuro → Automático no computador e no menu móvel.
2. Recarregar e navegar para outra página: a escolha deve continuar.
3. Em Automático, alternar a aparência do sistema operacional.
4. Conferir campos, foco pelo teclado, modais, cards e rodapés.
5. Conferir logos e imagens sem modificar a identidade das marcas.

Os dados e as permissões de perfis, equipes, torneios e administração
continuam sendo controlados pelos módulos existentes e pelo servidor.
