"use strict";

const process = require("process"); // Required to mock environment variables

// [START gae_flex_storage_app]
const { format } = require("util");
const express = require("express");
const Knex = require("knex");
const bodyParser = require("body-parser");
const Multer = require("multer");

// By default, the client will authenticate using the service account file
// specified by the GOOGLE_APPLICATION_CREDENTIALS environment variable and use
// the project specified by the GOOGLE_CLOUD_PROJECT environment variable. See
// https://github.com/GoogleCloudPlatform/google-cloud-node/blob/master/docs/authentication.md
// These environment variables are set automatically on Google App Engine
const { Storage } = require("@google-cloud/storage");

// Instantiate a storage client
const storage = new Storage();

// respuesta de error en peticiones API
let respuestaError = {
  error: true,
  codigo: 500,
  mensaje: "error"
};

const app = express();
// app.enable('trust proxy');

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
// app.use(express.static('public'));

app.use(function(req, res, next) {
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:3000");
  res.setHeader("Access-Control-Allow-Methods", "*");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-Requested-Width, content-type"
  );
  res.setHeader("Access-Control-Allow-Credentials", true);
  next();
});

const connect = () => {
  const config = {
    user: process.env.SQL_USER_SENA,
    password: process.env.SQL_PASSWORD_SENA,
    database: process.env.SQL_DATABASE_SENA
  };

  if (
    process.env.INSTANCE_CONNECTION_NAME &&
    process.env.NODE_ENV === "production"
  ) {
    config.socketPath = `/cloudsql/${process.env.INSTANCE_CONNECTION_NAME}`;
  }

  // Connect to the database
  const knex = Knex({
    client: "mysql",
    connection: config
  });

  return knex;
};

const knex = connect();

// Multer is required to process file uploads and make them available via
// req.files.
const multer = Multer({
  storage: Multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // no larger than 5mb, you can change as needed.
  }
});

// A bucket is a container for objects (files).
const bucket = storage.bucket(process.env.GCLOUD_STORAGE_BUCKET);

/* 
_
**********************************************************************************
*API especializacionSena                                                         *  
*Sitios                                                                          *
**********************************************************************************
_
*/
app.get("/sitios", (req, res, next) => {
  knex
    .from("tbsitios")
    .then(res => {
      return res;
    })
    .then(data => {
      data = data.map(item => {
        // item.photo = "http://"+ req.headers.host + "/images/" +item.photo;
        return item;
      });
      console.log(data);
      res.status(200).send({ info: data });
    })
    .catch(err => {
      res.status(500).send({ err: err.sqlMessage, info: err });
    });
});
app.post("/sitios", (req, res, next) => {
  console.log(req.body);
  if (
    !req.body.name ||
    !req.body.info ||
    !req.body.photo ||
    !req.body.rate ||
    !req.body.coords
  ) {
    respuestaError.mensaje = "Hacen falta parametros";
    res.send(respuestaError);
  } else {
    const sitio = {
      id: req.body.id,
      name: req.body.name,
      info: req.body.info,
      photo: req.body.photo,
      rate: req.body.rate,
      coords: req.body.coords
    };
    knex("tbsitios")
      .insert(sitio)
      .then(res => {
        return res;
      })
      .then(data => {
        res.status(200).send({ status: "OK" });
      })
      .catch(err => {
        res.status(500).send({ err: err.sqlMessage, info: err });
      });
  }
});
app.post("/sitios/upload", multer.single("photo"), (req, res, next) => {
  if (
    !req.file ||
    !req.body.name ||
    !req.body.info ||
    !req.body.rate ||
    !req.body.coords
  ) {
    respuestaError.mensaje = "Hacen falta parametros";
    respuestaError.codigo = 400;
    res.status(400).send(respuestaError);
    return;
  }

  // Create a new blob in the bucket and upload the file data.
  const blob = bucket.file(req.file.originalname);
  const blobStream = blob.createWriteStream();

  blobStream.on("error", err => {
    next(err);
  });

  blobStream.on("finish", () => {
    // The public URL can be used to directly access the file via HTTP.
    const publicUrl = format(
      `https://storage.googleapis.com/${bucket.name}/${blob.name}`
    );
    const sitio = {
      id: req.body.id,
      name: req.body.name,
      info: req.body.info,
      photo: publicUrl,
      rate: req.body.rate,
      coords: req.body.coords
    };
    knex("tbsitios")
      .insert(sitio)
      .then(res => {
        return res;
      })
      .then(data => {
        res.status(200).send({ status: "OK" });
      })
      .catch(err => {
        res.status(500).send({ err: err.sqlMessage, info: err });
      });
    // res.status(200).send(publicUrl);
  });

  blobStream.end(req.file.buffer);
});
app.get('/sitios/:id_sitio',(req,res,next) => {
  const id_sitio = parseInt(req.params.id_sitio) || "NaN";
  if(isNaN(id_sitio)){
    respuestaError.mensaje = "No es posible convertir el numero";
    respuestaError.codigo = 400;
    res.status(400).send(respuestaError);
    return;
  }
  knex('tbsitios').where({id:id_sitio}).then(res => {return res})
  .then(data => {
    res.status(200).send({info:data})
  })
  .catch(err => {
    respuestaError.mensaje = err.sqlMessage;
    res.status(400).send(respuestaError)
  })
});
app.delete('/sitios/:id_sitio',(req, res, next) => {
  const id_sitio = parseInt(req.params.id_sitio) || "NaN";
  if(isNaN(id_sitio)){
    respuestaError.mensaje = "No es posible convertir el numero";
    respuestaError.codigo = 400;
    res.status(400).send(respuestaError);
    return;
  }
  knex('tbsitios').where({id:id_sitio}).del().then(res => {return res})
  .then(data => {
    res.status(200).send({
      status:'OK',
      affected_rows:data
    })
  })
  .catch(err => {
    respuestaError.mensaje = err.sqlMessage;
    res.status(400).send(respuestaError)
  })
});
app.put('/sitios/:id_sitio',(req,res,next) => {
  const id_sitio = parseInt(req.params.id_sitio) || "NaN";
  if(isNaN(id_sitio)){
    respuestaError.mensaje = "No es posible convertir el numero";
    respuestaError.codigo = 400;
    res.status(400).send(respuestaError);
    return;
  }
  knex('tbsitios').where({id:id_sitio}).then(res => {return res})
  .then(data => {
    let sitio = data[0];
    delete sitio.id;
    if(req.body.name){
      sitio.name = req.body.name;
    }
    if(req.body.info){
      sitio.info = req.body.info;
    }
    if(req.body.rate){
      sitio.rate = parseInt(req.body.rate) || sitio.rate;
    }
    knex('tbsitios').where({id:id_sitio}).update(sitio).then(res => {return res})
    .then(data => {
      res.status(200).send({
        status:'OK',
        affected_rows:data
      });
    })
    
  })
  
})
/* 
_
**********************************************************************************
*API especializacionSena                                                         *  
*Usuarios                                                                        *
**********************************************************************************
_
*/
app.get("/usuarios", (req, res, next) => {
  if (!req.query.username || !req.query.password) {
    respuestaError.mensaje = "faltan parametros";
    respuestaError.codigo = 400;
    res.status(400).send(respuestaError);
  } else {
    knex("tbusuarios")
      .where("username", req.query.username)
      .where("password", req.query.password)
      .then(res => {
        return res;
      })
      .then(data => {
        if (data.length > 0) {
          res.status(200).send({ status: "ok", data: data[0].username });
        } else {
          res.status(401).send({ status: "unauthorized" });
        }
      });
  }
});
/* 
_
**********************************************************************************
*API especializacionSena                                                         *  
*Comentarios                                                                     *
**********************************************************************************
_
*/
app.get("/comentarios/:id_sitio", (req, res, next) => {
  knex
    .from("tbcomentarios")
    .where("id_sitio", req.params.id_sitio)
    .then(res => {
      return res;
    })
    .then(data => {
      res.status(200).send({ info: data });
    })
    .catch(err => {
      res.status(500).send({ err: err.sqlMessage, info: err });
    });
});
app.post("/comentarios/:id_sitio", (req, res, next) => {
  if (!req.body.comment) {
    respuestaError.mensaje = "Hacen falta parametros";
    res.send(respuestaError);
  } else {
    const comment = {
      id_sitio: req.params.id_sitio,
      comment: req.body.comment,
      user: req.body.user || "anonimo"
    };
    knex("tbcomentarios")
      .insert(comment)
      .then(res => {
        return res;
      })
      .then(data => {
        res.status(200).send({ status: "OK" });
      })
      .catch(err => {
        res.status(500).send({ err: err.sqlMessage, info: err });
      });
  }
});

// app.get('/otro', async (req, res, next) => {
//   // Create a visit record to be stored in the database
//   const visit = {
//     timestamp: new Date(),
//     // Store a hash of the visitor's ip address
//     userIp: crypto
//       .createHash('sha256')
//       .update(req.ip)
//       .digest('hex')
//       .substr(0, 7),
//   };

//   try {
//     await insertVisit(knex, visit);

//     // Query the last 10 visits from the database.
//     const visits = await getVisits(knex);
//     res
//       .status(200)
//       .set('Content-Type', 'text/plain')
//       .send(`Last 10 visits:\n${visits.join('\n')}`)
//       .end();
//   } catch (err) {
//     next(err);
//   }
// });
/**
 * Insert a visit record into the database.
 *
 * @param {object} knex The Knex connection object.
 * @param {object} visit The visit record to insert.
 * @returns {Promise}
 */
// const insertVisit = (knex, sitio) => {
//   return knex('tbsitios').insert(sitio);
// };

/**
 * Retrieve the latest 10 visit records from the database.
 *
 * @param {object} knex The Knex connection object.
 * @returns {Promise}
 */
// const getVisits = async knex => {
//   const results = await knex
//     .select('timestamp', 'userIp')
//     .from('visits')
//     .orderBy('timestamp', 'desc')
//     .limit(10);

//   return results.map(
//     visit => `Time: ${visit.timestamp}, AddrHash: ${visit.userIp}`
//   );
// };
// const Storage = multer.diskStorage({
//   destination(req, file, callback) {
//     callback(null, './public/images')
//   },
//   filename(req, file, callback) {
//     callback(null, `${file.fieldname}_${Date.now()}_${file.originalname}`)
//   }
// });

// const upload = multer({ storage: Storage });

// app.post('/api/upload', upload.array('photo', 3), (req, res) => {
//   console.log('file', req.files)
//   console.log('body', req.body)
//   res.status(200).json({
//     message: 'success!',
//   })
// })
// app.post("/sitios/upload", multer.array("photo", 3), (req, res, next) => {
//   console.log(req.body);
//   if (!req.body.name || !req.body.info || !req.body.rate || !req.body.coords) {
//     respuestaError.mensaje = "Hacen falta parametros";
//     res.send(respuestaError);
//   } else {
//     const sitio = {
//       id: req.body.id,
//       name: req.body.name,
//       info: req.body.info,
//       photo: req.files[0].filename,
//       rate: req.body.rate,
//       coords: req.body.coords
//     };
//     knex("tbsitios")
//       .insert(sitio)
//       .then(res => {
//         return res;
//       })
//       .then(data => {
//         res.status(200).send({ status: "OK" });
//       })
//       .catch(err => {
//         res.status(500).send({ err: err.sqlMessage, info: err });
//       });
//   }
// });

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
  console.log("Press Ctrl+C to quit.");
});
