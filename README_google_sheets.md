# Setup Sync Google Sheets

Istruzioni per configurare il backup automatico dei dati su Google Sheets.

## Prerequisiti
- Un account Google
- Accesso a https://script.google.com

## Passo 1: Creare il foglio Google

1. Vai su https://sheets.google.com
2. Crea un nuovo foglio vuoto (anche senza nome, lo script lo crea)
3. Copia l'ID del foglio dall'URL: `https://docs.google.com/spreadsheets/d/【QUESTO_E_L_ID】/edit`

## Passo 2: Creare lo script Google Apps Script

1. Vai su https://script.google.com
2. Clicca "Nuovo progetto"
3. Cancella il codice predefinito
4. Copia il contenuto del file `google-apps-script.gs` di questo progetto
5. Incolla tutto nel editor
6. **Sostituisci** `YOUR_SPREADSHEET_ID_HERE` con l'ID del tuo foglio Google (copiato al Passo 1)
7. Salva (Ctrl+S)

## Passo 3: Collegare il foglio allo script

1. Nel editor Google Apps Script, clicca l'icona del progetto (cartella) a sinistra
2. Rinomina il progetto (es. "Ore Interventi Sync")
3. Clicca "Servizi" (+) nella barra laterale sinistra
4. **Non serve aggiungere servizi** - lo script usa solo SpreadsheetApp integrato

## Passo 4: Deploy come Web App

1. Clicca "Deploy" > "Nuovo deploy"
2. Seleziona tipo: "App Web"
3. Configura:
   - **Esegui come**: "Io (la tua email)"
   - **Chi ha accesso**: "Chiunque" (senza autenticazione)
4. Clicca "Deploy"
5. Autorizza l'accesso quando richiesto
6. **Copia l'URL del Web App** (inizia con `https://script.google.com/macros/s/...`)

## Passo 5: Configurare l'app

1. Apri la tua app "Ore Interventi"
2. Apri il menu (icona hamburger in alto a destra)
3. Clicca "Imposta Sync Google Sheets"
4. Incolla l'URL del Web App copiato al passo 4
5. Clicca OK

L'app sincronizzerà automaticamente tutti i dati esistenti e futuri.

## Note

- Il foglio Google verrà creato automaticamente con le intestazioni corrette al primo sync
- Ogni modifica viene salvata automaticamente sia in locale che su Google Sheets
- Se sei offline, le modifiche vengono accodate e riprovate alla riconnessione
- L'indicatore nell'header mostra lo stato del sync (OK, SYNC..., ERR, OFFLINE, OFF)
- Per disabilitare il sync, vai al menu e inserisci una stringa vuota nell'URL

## Troubleshooting

- **"ERR" nell'indicatore**: Verifica che l'URL del Web App sia corretto
- **"Cannot read properties of null"**: Assicurati di aver inserito l'ID del foglio nella costante `SPREADSHEET_ID` nel codice dello script
- **Dati non si sincronizzano**: Controlla che il deploy sia "Chiunque" e non "Solo io"
- **Primo sync lento**: Normale se hai molti dati, impiega qualche secondo
