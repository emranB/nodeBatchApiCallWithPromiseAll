const express = require('express');
const app = express();
const port = 3000;
const bodyParser = require('body-parser')
const requestLib = require('request')
const batchReqCfg = require('./config/batchReq.json')
var cors = require('cors')

app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(express.json());
app.use(cors({
    origin: 'http://localhost'
}))

let lastId = 0;
function generateId() {
    lastId++;
    return lastId;
}

/*
    interface IBrewery {
        id: number;
        name: string;
        tags: string[];
        street: string;
        city: string;
        isOpen: boolean;
    }
*/

// <string, IBrewery>
const breweryDb = new Map();


function searchBreweries(req, res) {
    const results = [];
    for (const [breweryId, brew] of breweryDb.entries()) {
        let numRequirements = 0;
        let numMatches = 0;
        if (req.query.name) {
            numRequirements++;
            // contains match
            if (brew.name.toLowerCase().indexOf(req.query.name.toLowerCase()) > -1 ) {
                numMatches++;
            }
        }
        if (req.query.city) {
            numRequirements++;
            // exact match
            if (brew.city.toLowerCase() === req.query.city.toLowerCase()) {
                numMatches++;
            }
        }
        if (req.query.tags) {
            const tags = req.query.tags.split(',');
            // brute search
            for (const t of tags) {
                numRequirements++;
                for (const b of brew.tags) {
                    if (t.toLowerCase() === b.toLowerCase()) {
                        numMatches++;
                        break
                    }
                }
            }
        }
        if (numRequirements === numMatches) {
            results.push(brew);
        }
    }
    res.status(200)
        .json({
            breweries: results
        });
}

function addBrewery(req, res) {
    if (!req.body) {
        res.status(400)
            .json({error: 'Invalid request'});
        return;
    }
    let brew = {};
    brew.name = (req.body.name || '').trim();
    if (!brew.name) {
        res.status(400)
            .json({error: 'Invalid Brewery Name'});
        return;
    }
    brew.city = (req.body.city || '').trim();
    if (!brew.city) {
        res.status(400)
            .json({error: 'Invalid Brewery City'});
        return;
    }
    brew.street = (req.body.street || '').trim();
    if (!brew.street) {
        res.status(400)
            .json({error: 'Invalid Brewery Street'});
        return;
    }
    brew.isOpen = false;
    brew.id = generateId();
    breweryDb.set(brew.id, brew);
    res.status(201)
        .json(brew);
}

function validateSubRequest(req, res) {
    if (!req.params.breweryId) {
        res.status(400)
            .json({error: 'Brewery Id required'});
        return false;
    }
    req.params.breweryId = parseInt(req.params.breweryId);
    if (!breweryDb.has(req.params.breweryId)) {
        res.status(400)
            .json({error: 'No such brewery'});
        return false;
    }
    return true;
}

function getBrewery(req, res) {
    if (!validateSubRequest(req, res)) {
        return;
    }
    res.status(200)
        .json(breweryDb.get(req.params.breweryId));
}

function updateBrewery(req, res) {
    if (!validateSubRequest(req, res)) {
        return;
    }
    const brew = breweryDb.get(req.params.breweryId);
    if (req.body.name !== undefined) {
        const name = req.body.name.trim();
        if (!name) {
            res.status(400)
                .json({error: 'Invalid Brewery Name'});
            return;
        }
        brew.name = name;
    }
    if (req.body.city !== undefined) {
        const city = req.body.city.trim();
        if (!city) {
            res.status(400)
                .json({error: 'Invalid Brewery City'});
            return;
        }
        brew.city = city;
    }
    if (req.body.street !== undefined) {
        const street = req.body.street.trim();
        if (!street) {
            res.status(400)
                .json({error: 'Invalid Brewery Street'});
            return;
        }
        brew.street = street;
    }
    if (req.body.isOpen !== undefined) {
        if (req.body.isOpen === true) {
            brew.isOpen = true;
        } else {
            brew.isOpen = false;
        }
    }
    breweryDb.set(brew.id, brew);
    res.status(200)
        .end();

}

function deleteBrewery(req, res) {
    breweryDb.delete(parseInt(req.params.breweryId));
    res.status(200)
        .end();
}

function testHome(req, res) {
    res.status(200)
        .json({success: 'Server APIs running OK.'})
        .end()
}

function batchTest(req, res) {
    res.status(200)
        .json({success: 'Batch request API found'})
        .end();
}

function batchProcess(req, res) {
    let compressedRequests = {}
    if (req.body && req.body !== undefined && Object.keys(req.body).length)
        compressedRequests = compressRequests(req.body)
    else 
        compressedRequests = compressRequests(batchReqCfg)
        
    processBatchRequests(compressedRequests)
    res.status(200)
        .json({success: 'Processed batch request.'})
        .end();
}

// Classify requests to their own group based on method
function compressRequests(jsonData) {
    let requestsList = {
        delete: [],
        post:   [],
        put:    [],
        get:    []
    }

    for (let request of jsonData.requests) {
        switch(request.method) {
            case 'post': 
                requestsList.post.push(request)
                break
            case 'put':
                requestsList.put.push(request)
                break
            case 'delete':
                requestsList.delete.push(request)
                break
            case 'get':
                requestsList.get.push(request)
                break
            default:
                console.log(`Unknown request: ${request}`)
        }
    }

    return requestsList
}

// Perform all batched requests
// Note: This implementation calls pre-defined APIs to the DB, zero to n times, to reuse code.
//      In practice, each type of batch request would be optimized to query the DB
//      as close to 1 time for each batch as possible
function processBatchRequests(requests) {
    let responses = []
    let promises = []

    // Priority = DELETE > PUT > POST > GET
    // Push DELETE requessts
    for (let request of requests.delete) {
        const options = {
            url: request.endpoint,
            method: 'DELETE'
        }

        let p = new Promise((resolve, reject) => {
            requestLib(options, (err, resp) => {
                if (err) reject(err)
                if (resp) resolve(resp)
            })
        }).then(data => responses.push(data))
        promises.push(p)
    }    

    // Push PUT requessts
    for (let request of requests.put) {
        const options = {
            url: request.endpoint,
            method: 'PUT',
            body: request.body || [],
            json: true
        }

        let p = new Promise((resolve, reject) => {
            requestLib(options, (err, resp) => {
                if (err) reject(err)
                if (resp) resolve(resp)
            })
        }).then(data => responses.push(data))
        promises.push(p)
    }    

    // Push POST requessts
    for (let request of requests.post) {
        const options = {
            url: request.endpoint,
            method: 'POST',
            body: request.body || [],
            json: true
        }

        let p = new Promise((resolve, reject) => {
            requestLib(options, (err, resp) => {
                if (err) reject(err)
                if (resp) resolve(resp)
            })
        }).then(data => responses.push(data))
        promises.push(p)
    }    

    // Push GET requessts
    for (let request of requests.get) {
        const options = {
            url: request.endpoint,
            method: 'GET',
            json: true
        }

        let p = new Promise((resolve, reject) => {
            requestLib(options, (err, resp) => {
                if (err) reject(err)
                if (resp) resolve(resp)
            })
        }).then(data => responses.push(data))
        promises.push(p)
    }    

    // Process all requests
    Promise.all(promises)
}

function listAllBreweries(req, res) {
    let out = {breweries: []}
    for (let [ i, brew ] of breweryDb.entries()) {
        out.breweries.push(brew)
    }

    res.status(200)
        .json(out)
        .end()
}

// assign endpoints to their handlers
app.route('/')
    .get(testHome)
app.route('/brewery')
    .get(searchBreweries)
    .put(addBrewery);
app.route('/brewery/:breweryId')
    .get(getBrewery)
    .post(updateBrewery)
    .delete(deleteBrewery);
// TODO:
app.route('/brewery/batch/process')
    .get(batchTest)
    .post(batchProcess)
app.route('/brewery/list/all')
    .get(listAllBreweries)


app.listen(port, () => {
    console.log(`Brewery app listening on port ${port}`)
});
