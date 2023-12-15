const express = require('express');

const app = express();
require("dotenv").config();
const cors = require("cors");
const axios = require("axios");
const port = process.env.PORT;
const uri = process.env.URI
const Payment = require("./models/paymentModel")

const mongoose = require('mongoose');

mongoose.connect(uri).then(()=>{
    console.log('db connected succesfully');
}).catch((err)=>{
    console.log(err.message);
})

app.listen(port,()=>{
    console.log(`app is running at localhost:${port}`);
});

app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(cors());
app.get('/', (req, res) => {
    res.send('Hello, world!');
});

const generateToken = async (req,res,next)=>{

    const key = process.env.MPESA_CONSUMER_KEY;   
    const secret = process.env.MPESA_CONSUMER_SECRET;


    const auth = new Buffer.from(`${key}:${secret}`).toString("base64");

    await axios
        .get("https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",{
            headers: {
                authorization: `Basic ${auth}`,
            },
        }).then((response)=>{
            // console.log(response.data.access_token);
            token = response.data.access_token;
            next();
        }).catch((err)=>{
            console.log(err);
            // res.status(400).json(err.message);
        })
}

app.post("/stk", generateToken , async (req,res)=>{
    const phone = req.body.phone.substring(1);
    const amount = req.body.amount;

    const date = new Date();
    const timestamp = 
    date.getFullYear() + 
    ("0" + (date.getMonth()+1)).slice(-2) +
    ("0" + (date.getDate()+1)).slice(-2) +
    ("0" + (date.getHours()+1)).slice(-2) +
    ("0" + (date.getMinutes()+1)).slice(-2) +
    ("0" + (date.getSeconds()+1)).slice(-2);

    const shortcode = process.env.MPESA_PAYBILL;
    const passkey = process.env.MPESA_PASSKEY;

    const password = new Buffer.from(shortcode + passkey + timestamp).toString("base64")

    await axios.post(
        "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
        {    
            BusinessShortCode: shortcode,    
            Password: password,    
            Timestamp:timestamp,    
            TransactionType: "CustomerPayBillOnline",    
            Amount: amount,    
            PartyA:`254${phone}`,    
            PartyB:shortcode,    
            PhoneNumber:`254${phone}`,    
            CallBackURL: "https://ebenezer-8t75.onrender.com/callback",    
            AccountReference:`254${phone}`,    
            TransactionDesc:"Test"
         },
         {
            headers:{
                Authorization:`Bearer ${token}`
            }
        }
        
    ).then((data)=>{
        console.log(data.data);
        res.status(200).json(data.data)
    }).catch((err)=>{
        console.log(err.message);
        res.status(400).json(err.message)
    });
});

app.post("/callback", (req,res)=>{
    const callbackData = req.body;
    console.log(callbackData.Body);

    if(!callbackData.Body.stkCallback.CallbackMetadata){
        console.log(callbackData.Body.stkCallback.CallbackMetadata);
        return res.json("ok");
    }

    console.log(callbackData.Body.stkCallback.CallbackMetadata);

     const phone = callbackData.Body.stkCallback.CallbackMetadata.Item[4].Value;
     const amount = callbackData.Body.stkCallback.CallbackMetadata.Item[0].Value;
     const trnx_id = callbackData.Body.stkCallback.CallbackMetadata.Item[1].Value;

    const payment = new Payment();

    payment.number = phone;
    payment.amount = amount;
    payment.trnx_id = trnx_id;

    payment.save().then((data)=>{
        console.log({message:"saved succesfully",data});
    }).catch((err)=>{
        console.log(err.message);
    })

})

app.get('/payments', async (req, res) => {
    try {
      // Retrieve all payments from the database
      const payments = await Payment.find();
      res.json(payments);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });