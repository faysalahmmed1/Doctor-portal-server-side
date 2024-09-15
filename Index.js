const { MongoClient, ServerApiVersion } = require('mongodb');
const express = require('express');
require('dotenv').config()
const jwt = require('jsonwebtoken');
const cors = require('cors');
const app = express()
const port = process.env.PORT || 5000;


app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ujark58.mongodb.net/?retryWrites=true&w=majority`;


const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

function varifyJWT(req, res, next) {
    const authHeard = req.headers.authorizaton;
    if (authHeard) {
        return res.status(401).send({ message: 'UnAuthorized access' });
    }

    const token = authHeard.split('')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden Access' })
        }
        req.decoded = decoded;
        next();
    });
}


async function run() {
    try {
        // await client.close();

        const serviceCollection = client.db('doctors_portal').collection('services');
        const bookingCollection = client.db('doctors_portal').collection('booking');
        const userCollection = client.db('doctors_portal').collection('users');
        const doctorsCollection = client.db('doctors_portal').collection('doctors');

        app.get('/', (req, res) => {
            res.send('The Server is Runnig!!')
        });

        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user,
            };

            const result = await userCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            res.send({ result, token });
        });


        app.get('available', async (req, res) => {
            const date = req.query.date;
            const services = await serviceCollection.find().toArray();
            const query = { date: date };
            const bookings = await bookingCollection.find(query).toArray();
            services.forEach(service => {
                const servicbookings = bookings.filter(b => b.treatMent === service.name);
                const booked = servicbookings.map(s => s.slot);
                const available = service.slots.filter(s => !booked.includes(s));
                service.available = available;

            })
            res.send(services);
        });

        app.get('/booking', varifyJWT, async (req, res) => {
            const patient = req.query.patient;
            const decodedEmail = req.decoded.email;
            if (patient === decodedEmail) {
                const query = { patient: patient };
                const authorizaton = req.headers.authorizaton;
                const bookings = await bookingCollection.find(query).toArray();
                return res.send(bookings);
            }
            else {
                res.status(403).send({ message: 'forbidden access' });
            }


        });


        app.post('/booking', async (req, res) => {
            const booking = req.body;
            const query = { treatMent: booking.treatMent, date: booking.date, patient: booking.patient }
            const exists = await bookingCollection.findOne(query);
            if (exists) {
                return res.send({ success: false, booking: exists })
            }
            const result = await bookingCollection.insertOne(booking);

            return res.send({ success: true, result });

        });

        app.get('/service', async (req, res) => {
            const query = {};
            const curcor = serviceCollection.find(query).project({ name: 1 });
            const services = await curcor.toArray();
            res.send(services);
        });

        app.post('/doctor', varifyJWT, async (req, res) => {
            const doctor = req.body;
            const result = await doctorsCollection.insertOne(doctor);
            res.send(result);
        })
    }
    finally {

    }

}
run().catch(console.dir);

app.listen(port, () => {
    console.log(`Doctor Portal listening on port ${port}`)
})