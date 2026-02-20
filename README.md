# Ore Interventi PWA

Mini app PWA locale per registrare interventi cliente e stato pagamento.

## Avvio rapido

1. Avvia un server statico nella cartella `ore-interventi-pwa`.
2. Apri `http://localhost:PORT`.
3. Installa la PWA dal browser (opzionale).

Esempio con Node:

```bash
npx serve .
```

## Funzioni

- Home con due azioni: `Clienti` e `Nuovo intervento`
- Nuovo intervento: cliente (con suggerimenti), data, ora inizio/fine, descrizione
- Scheda cliente: solo interventi non pagati, selezione per pagamento, totale ore
- Stato locale in `localStorage` (offline-first)
