# Gestore Interventi Orari

App web statica (PWA) per registrare ore di intervento per cliente, con stato pagamenti e dati salvati in `localStorage`.

## Requisiti

- Node.js 18+ (consigliato)
- Account Vercel (solo per deploy cloud)

## Avvio locale

```bash
npm run dev
```

L'app viene servita in locale tramite server statico.

## Deploy su Vercel

1. Collega il repository al progetto su Vercel.
2. Imposta framework: `Other`.
3. Build command: lascia vuoto.
4. Output directory: lascia vuoto (root).
5. Deploy.

In alternativa da CLI:

```bash
npm run deploy:prod
```

## Funzionalita principali

- Home con `Clienti` e `Nuovo intervento`
- Inserimento intervento con cliente, data, ora inizio/fine e descrizione
- Dettaglio cliente con interventi non pagati, selezione e chiusura pagamento
- Tariffa oraria per cliente e totale importi
- Supporto offline via Service Worker
