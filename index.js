const express = require('express');
const cors = require('cors');
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 3000;

const admin = require("firebase-admin");

// Initialize Firebase Admin from environment (preferred) or local file for dev.
// Recommended: set FIREBASE_SERVICE_ACCOUNT to the full service-account JSON in Render/hosting env.
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
        const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({
            credential: admin.credential.cert(sa)
        });
        console.log('Firebase Admin initialized from FIREBASE_SERVICE_ACCOUNT env var');
    } catch (err) {
        console.error('Invalid JSON in FIREBASE_SERVICE_ACCOUNT:', err.message || err);
        throw err;
    }
} else if (process.env.FIREBASE_SERVICE_ACCOUNT_B64) {
    // Support base64-encoded JSON (if you prefer that for secrets systems)
    try {
        const json = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_B64, 'base64').toString('utf8');
        const sa = JSON.parse(json);
        admin.initializeApp({
            credential: admin.credential.cert(sa)
        });
        console.log('Firebase Admin initialized from FIREBASE_SERVICE_ACCOUNT_B64 env var');
    } catch (err) {
        console.error('Invalid base64/service-account JSON in FIREBASE_SERVICE_ACCOUNT_B64:', err.message || err);
        throw err;
    }
} else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    // Use application default credentials when GOOGLE_APPLICATION_CREDENTIALS is set
    admin.initializeApp({
        credential: admin.credential.applicationDefault()
    });
    console.log('Firebase Admin initialized using GOOGLE_APPLICATION_CREDENTIALS (applicationDefault)');
} else {
    // Local file fallback (only for local development)
    try {
        const serviceAccount = require('./smart-deals-firebase-admin-key.json');
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log('Firebase Admin initialized from ./smart-deals-firebase-admin-key.json');
    } catch (err) {
        console.error('Firebase service account not provided. Set FIREBASE_SERVICE_ACCOUNT env var or GOOGLE_APPLICATION_CREDENTIALS.');
        throw err;
    }
}


// middleware
app.use(cors());
app.use(express.json())

const verifyFireBaseToken = async (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ message: 'unauthorized access' })
    }
    const token = authorization.split(' ')[1];

    try {
        const decoded = await admin.auth().verifyIdToken(token);
        console.log('inside token', decoded)
        req.token_email = decoded.email;
        next();
    }
    catch (error) {
        return res.status(401).send({ message: 'unauthorized access' })
    }
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.qrspure.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

app.get('/', (req, res) => {
    res.send('Smart server is running')
})

async function run() {
    try {
        await client.connect();

        const db = client.db('smartDealsDB');
        const productsCollection = db.collection('products');
        const bidsCollection = db.collection('bids');
        const usersCollection = db.collection('users');

        // USERS APIs
        app.post('/users', async (req, res) => {
            const newUser = req.body;
            const email = req.body.email;
            const query = { email: email }
            const existingUser = await usersCollection.findOne(query);

            if (existingUser) {
                res.send({ message: 'user already exits. do not need to insert again' })
            }
            else {
                const result = await usersCollection.insertOne(newUser);
                res.send(result);
            }
        })

        // PRODUCTS APIs
        app.get('/products', async (req, res) => {
            // const projectFields = { title: 1, price_min: 1, price_max: 1, image: 1 }
            // const cursor = productsCollection.find().sort({ price_min: -1 }).skip(2).limit(2).project(projectFields);

            console.log(req.query)
            const email = req.query.email;
            const query = {}
            if (email) {
                query.email = email;
            }

            const cursor = productsCollection.find(query);
            const result = await cursor.toArray();
            res.send(result)
        });

        app.get('/latest-products', async (req, res) => {
            const cursor = productsCollection.find().sort({ created_at: -1 }).limit(6);
            const result = await cursor.toArray();
            res.send(result);
        })

        app.get('/products/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await productsCollection.findOne(query);
            res.send(result);
        })

        app.post('/products', verifyFireBaseToken, async (req, res) => {
            console.log('headers in the post ', req.headers)
            const newProduct = req.body;
            const result = await productsCollection.insertOne(newProduct);
            res.send(result);
        })

        // app.patch('/products/:id', async (req, res) => {
        //     const id = req.params.id;
        //     const updatedProduct = req.body;
        //     const query = { _id: new ObjectId(id) }
        //     const update = {
        //         $set: {
        //             name: updatedProduct.name,
        //             price: updatedProduct.price
        //         }
        //     }

        //     const result = await productsCollection.updateOne(query, update)
        //     res.send(result)
        // })

        app.patch('/products/:id', verifyFireBaseToken, async (req, res) => {
            try {
                const id = req.params.id;
                const updatedProduct = req.body || {};
                const query = { _id: new ObjectId(id) };

                // Ensure the product exists
                const existing = await productsCollection.findOne(query);
                if (!existing) {
                    return res.status(404).send({ message: 'Product not found' });
                }

                // If the client requests a status change, only allow the product owner
                if (updatedProduct.status && existing.email !== req.token_email) {
                    return res.status(403).send({ message: 'Forbidden: only owner can change status' });
                }

                // Build the $set update only with provided fields
                const updateFields = {};
                if (updatedProduct.name !== undefined) updateFields.name = updatedProduct.name;
                if (updatedProduct.price !== undefined) updateFields.price = updatedProduct.price;
                if (updatedProduct.status !== undefined) updateFields.status = updatedProduct.status;

                // If nothing to update, return 400
                if (Object.keys(updateFields).length === 0) {
                    return res.status(400).send({ message: 'No updatable fields provided' });
                }

                const update = { $set: updateFields };
                const result = await productsCollection.updateOne(query, update);

                // Optionally return the updated document
                const updated = await productsCollection.findOne(query);
                res.send({ matchedCount: result.matchedCount, modifiedCount: result.modifiedCount, updated });
            } catch (err) {
                console.error('PATCH /products/:id error', err);
                res.status(500).send({ message: 'Server error' });
            }
        });

        app.delete('/products/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await productsCollection.deleteOne(query);
            res.send(result);
        })

        // bids related apis
        app.get('/bids', verifyFireBaseToken, async (req, res) => {
            const email = req.query.email;
            const query = {};
            if (email) {
                query.buyer_email = email;
                if (email !== req.token_email) {
                    return res.status(403).send({ message: 'forbidden access' })
                }
            }

            const cursor = bidsCollection.find(query);
            const result = await cursor.toArray();
            res.send(result);
        })


        app.get('/products/bids/:productId', async (req, res) => {
            const productId = req.params.productId;
            const query = { product: productId }
            const cursor = bidsCollection.find(query).sort({ bid_price: -1 })
            const result = await cursor.toArray();
            res.send(result);
        })

        app.get('/bids', async (req, res) => {

            const query = {};
            if (query.email) {
                query.buyer_email = email;
            }

            const cursor = bidsCollection.find(query);
            const result = await cursor.toArray();
            res.send(result);
        })

        app.post('/bids', async (req, res) => {
            const newBid = req.body;
            const result = await bidsCollection.insertOne(newBid);
            res.send(result);
        })

        app.delete('/bids/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await bidsCollection.deleteOne(query);
            res.send(result);
        })

        // await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");




    }
    finally {

    }
}

run().catch(console.dir)

app.listen(port, () => {
    console.log(`Smart server is running on port: ${port}`)
})

// client.connect()
//     .then(() => {
//         app.listen(port, () => {
//             console.log(`Smart server is running now on port: ${port}`)
//         })

//     })
//     .catch(console.dir)