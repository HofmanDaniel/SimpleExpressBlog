const express = require("express");
const path = require("path");
const morgan = require("morgan");
const helmet = require("helmet");
const serveFavicon = require("serve-favicon");
const fs = require("fs");
const multer = require("multer");
const bodyParser = require("body-parser")
//percorsi
const publicFolder = path.join(__dirname, "public");//cartella pubblica
const loggerFile = path.join(__dirname, "logs/access.log");//file di log
const dataFile = path.join(__dirname, "data/articoli.json");//base di dati
const imageFolder = path.join(__dirname, "public/images");//cartella con le immagini caricate


//inizializzo l'applicativo express
const app = express();
//popolo l'oggetto che conterrà tutti i dati
const data = JSON.parse(fs.readFileSync(dataFile));

/*----------MIDDLEWARE----------*/
app.set("port", 80);//definisco la porta
app.set("appName", "Server statico");//definisco il nome
app.set("views", path.join(__dirname, "views"));//imposto la cartella delle viste
app.set("view engine", "pug");//imposto l'engine a pug

//uso il middleware per la gestione dell'icona
app.use(serveFavicon(path.join(imageFolder, "icon.png")))

//creo un flusso di dati per il file di log
const flussoLogger = fs.createWriteStream(loggerFile, { flags: "a" });

//applico il middleware per i log con la libreria morgan
app.use(morgan("dev", { stream: flussoLogger }));

//applico helmet per implementare funzioni di sicurezza 
app.use(helmet());

//parsing del body con metodo post
app.use(bodyParser.urlencoded({ extended: true }));

//inizializzazione dello storage di upload
const storage = multer.diskStorage({
    destination(req, file, cb) {
        cb(null, imageFolder);//cartella di destinaizone
    },
    filename(req, file, cb) {
        cb(null, Date.now() + "_" + file.originalname);//nome del file
    }
});
const upload = multer({//inizializzazione dell'accesso allo storage
    storage: storage
});

/*----------ROTTE----------*/
//imposto le rotte statiche
app.use("/public", express.static(publicFolder));

//rotta della homepage
app.get("/", (req, res) => {
    res.render("index", { data })
});

app.get("/admin", (req, res) => {
    res.render("admin", { data })
});

app.get("/articolo/:id", (req, res) => {
    let articolo = data.find(articolo => articolo.id == req.params.id);
    let articoloTemp = JSON.parse(JSON.stringify(articolo))
    articoloTemp.cover = articolo.cover != undefined ? "/public/images/" + articolo.cover : undefined;
    res.render("articolo", { articoloTemp })
});

app.get("/rimuovi/:id", (req, res) => {
    let articolo = data.find(articolo => articolo.id == req.params.id);
    if (articolo.cover !== undefined) {
        fs.unlink(path.join(imageFolder, articolo.cover), (err) => {
            if (err) throw err;
        });
    }
    data.splice(data.indexOf(articolo), 1);
    res.redirect("/");
});

app.get("/aggiungi", (req, res) => {
    res.render("aggiungi")
});

app.post("/aggiungi", upload.single("cover"), (req, res) => {
    let { titolo, contenuto } = req.body;
    let articolo = {
        "id": Date.now(),
        "titolo": titolo,
        "contenuto": contenuto,
        "cover": (req.file !== undefined) ? req.file.filename : undefined,
        "commenti": []
    };
    data.push(articolo);
    res.redirect("/");
});

app.get("/modifica/:id", (req, res) => {
    let articolo = data.find(articolo => articolo.id == req.params.id);
    res.render("modifica", { articolo });
});

app.post("/modifica", upload.single("cover"), (req, res) => {
    let articolo = data.find(articolo => articolo.id == req.body.id);
    articolo.titolo = req.body.titolo;
    articolo.contenuto = req.body.contenuto;
    if (req.file !== undefined) {
        fs.unlink(path.join(imageFolder, articolo.cover), (err) => {
            if (err) throw err;
        });
        articolo.cover = req.file.filename;
    }
    res.redirect("/");
});

app.post("/aggiungiCommento/:id", (req, res) => {
    let articolo = data.find(articolo => articolo.id == req.params.id);
    articolo.commenti.push({
        "autore": req.body.autore,
        "contenuto": req.body.contenuto
    })
    res.redirect("/articolo/" + req.params.id)
});

//intercetto richieste che non sono riuscito a gestire
app.use("*", (req, res) => {
    res.status(404);
    res.send("Pagina inesistente");
});

setInterval(() => {
    fs.writeFile(dataFile, JSON.stringify(data), (err) => {
        if (err) throw err;
    });
}, 60000);

const server = app.listen(app.get("port"), () => {
    console.log("Server attivo");
    console.log("Cartella per i file statici: " + publicFolder);
    console.log("File di log: " + loggerFile);
    console.log("File con i dati:" + dataFile);
    console.log("cartella con immagini: " + imageFolder)
});