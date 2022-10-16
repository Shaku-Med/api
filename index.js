const express = require( 'express' );
const app = express();
const http = require( 'http' );
const server = http.createServer( app );
const { Server } = require( "socket.io" );
const io = new Server( server );
const mysql = require( 'mysql' );
const cors = require( 'cors' );
const bodyParser = require( 'body-parser' );
const bcrypt = require( 'bcrypt' );
const store = require( "store" );
const fs = require( "fs" );
let formidable = require( 'formidable' );


app.use( express() );
app.use( cors( {
      origin: 'http://localhost:3000',
      methods: [ 'GET', 'POST' ]
} ) );
app.use( bodyParser.urlencoded( { extended: false } ) );


let mydb = {
      host: 'remotemysql.com',
      user: 'RclDXou8Bw',
      password: 'kzSRzGNAOT',
      database: 'RclDXou8Bw',
      charset: 'utf8mb4',
      multipleStatements: false,
      columnType: 'LONGTEXT CHARACTER SET utf8mb4'
};

let db;


function handleDisconnect ()
{
      db = mysql.createConnection( mydb );

      db.connect( function ( err )
      {
            if ( err )
            {
                  console.log( "error when connecting to db ", err );
                  setTimeout( handleDisconnect, 2000 );
            }
      } );

      db.on( 'error', function ( err )
      {
            console.log( 'db error', err );
            if ( err.code === 'PROTOCOL_CONNECTION_LOST' )
            { // Connection to the MySQL server is usually
                  handleDisconnect();                         // lost due to either server restart, or a
            } else
            {                                      // connnection idle timeout (the wait_timeout
                  throw err;                                  // server variable configures this)
            }
      } );
}

handleDisconnect();

app.post( "/csrf_api", ( req, res ) =>
{
      let api = req.body.token;
      store.set( "token", { name: api } );
      res.send( store.get( "token" ) );
} );


app.get( '/', ( req, res ) =>
{
      res.sendFile( __dirname + [ '/base/index.html' ] );
} );

app.get( "/Signup/Login", ( req, res ) =>
{
      res.sendFile( __dirname + [ '/base/join.html' ] );
} );

io.on( 'connection', ( socket ) =>
{
      socket.on( "online_status", ( data ) =>
      {
            db.query( "SELECT * FROM usr WHERE  unic_id=?", [ data ], ( er, re ) =>
            {
                  if ( re.length > 0 )
                  {
                        re.map( val =>
                        {
                              let ar = {
                                    names: val.name,
                                    profilepic: val.profilepic,
                                    unic_id: val.unic_id
                              };
                              io.emit( "newuser", ar );
                        } );
                  }
            } );
      } );

      socket.on( "chat_messages", ( data ) =>
      {
            let messagedata = {
                  message: data.message,
                  uid: data.uid,
                  messageid: data.messageid,
                  uname: data.uname,
                  profilepic: data.profilepic
            };
            io.emit( "grabmess", messagedata );

            db.query( "SELECT * FROM usr WHERE unic_id=?", [ data.uid ], ( ee, rr ) =>
            {
                  if ( rr.length > 0 )
                  {
                        rr.map( v =>
                        {
                              db.query( "INSERT INTO message (names, ide, message, messagetype, msgid) VALUE (?, ?, ?, ?, ?)", [ data.uname, data.uid, data.message, v.profilepic, data.messageid ], ( e, r ) =>
                              {
                              } );
                        } );
                  }
            } );

      } );

      socket.on( "typing", ( data ) =>
      {
            let dataasm = {
                  ides: data.ides,
                  names: data.names,
            };

            socket.broadcast.emit( "type", dataasm );
      } );

      socket.on( "donetyping", ( data ) =>
      {
            socket.broadcast.emit( "donetypings", data );
      } );

      socket.on( "delete_msg", ( data ) =>
      {
            io.emit( "dele", data );
            db.query( "DELETE FROM message WHERE msgid=?", [ data ], ( e, r ) =>
            {
            } );
      } );

} );

//Sign up

app.post( "/signup/login/post", ( req, res ) =>
{
      let ctoken = req.body.ctoken;

      if ( ctoken === store.get( "token" ).name )
      {
            let names = req.body.names;
            let uid = req.body.uid;
            let pass = req.body.pass;
            db.query( "SELECT * FROM usr WHERE name=?", [ names.toUpperCase() ], ( e, r ) =>
            {
                  if ( r.length > 0 )
                  {
                        r.map( v =>
                        {

                              if ( v.name !== names.toUpperCase() )
                              {
                                    res.send( "Account informations is invalid." );
                              }
                              else if ( v.pass !== pass )
                              {
                                    res.send( "Name / password is wrong." );
                              }
                              else 
                              {
                                    db.query( "SELECT * FROM usr WHERE unic_id=?", [ v.unic_id ], ( em, rm ) =>
                                    {
                                          if ( rm.length > 0 )
                                          {
                                                rm.map( val =>
                                                {
                                                      let ides = {
                                                            names: val.name,
                                                            user_c: val.unic_id,
                                                            success: "success"
                                                      };
                                                      res.send( ides );
                                                } );
                                          }
                                    } );
                              }
                        } );
                  }
                  else
                  {
                        let pp = "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png";
                        db.query( "INSERT INTO usr (name, pass, unic_id, profilepic) VALUES (?, ?, ?, ?)", [ names.toUpperCase(), pass, uid, pp ], ( er, re ) =>
                        {
                              res.send( "success" );
                        } );
                  }
            } );
      }
      else
      {
            res.send( "unable to signup / Login. your token is invalid!" );
      }
} );

app.post( "/checkexist", ( req, res ) =>
{
      let ide = req.body.ide;
      db.query( "SELECT * FROM usr WHERE unic_id=?", [ ide ], ( e, r ) =>
      {
            if ( r.length > 0 )
            {
                  res.send( 'success' );
            }
            else
            {
                  res.send( "no" );
            }
      } );
} );

app.post( "/grab_info/session", ( req, res ) =>
{
      let ide = req.body.ide;
      db.query( "SELECT * FROM usr WHERE unic_id=?", [ ide ], ( e, r ) =>
      {
            if ( r.length > 0 )
            {
                  r.map( val =>
                  {
                        let rar = {
                              profilepic: val.profilepic,
                              names: val.name
                        };
                        res.send( rar );
                  } );
            }
      } );
} );


app.post( "/fetch_chat_data/Now", ( req, res ) =>
{
      db.query( "SELECT * FROM message", ( e, r ) =>
      {
            if ( r.length > 0 )
            {
                  res.send( r );
            }
            else
            {
                  res.send( "nope" );
            }
      } );
} );



server.listen( 3000, () =>
{
      console.log( 'listening on *:3000' );
} );