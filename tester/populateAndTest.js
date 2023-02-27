const got = require('got');
const assert = require('assert')

async function run() {
    try {
        await got.put('http://localhost:3000/brewery', {json: {name: 'Test Brew', city: 'Seattle', street: '123 Main'}});
        await got.put('http://localhost:3000/brewery', {json: {name: 'Brew For U', city: 'Oslo', street: '456 Odd Street'}});
        let resp = await got.get('http://localhost:3000/brewery', {responseType: 'json'});
        // console.log(resp.body);
        assert.equal(resp.body.breweries.length, 2);
        resp = await got.get('http://localhost:3000/brewery?city=oslo', {responseType: 'json'});
        assert.equal(resp.body.breweries.length, 1);
        assert.equal(resp.body.breweries[0].name, 'Brew For U');
        assert.equal(resp.body.breweries[0].isOpen, false);
        await got.post('http://localhost:3000/brewery/2', {json: {name: 'Brew For Me', isOpen: true}});
        resp = await got.get('http://localhost:3000/brewery/2', {responseType: 'json'});
        assert.equal(resp.body.isOpen, true);
        assert.equal(resp.body.name, 'Brew For Me');
        await got.delete('http://localhost:3000/brewery/2');
        resp = await got.get('http://localhost:3000/brewery', {responseType: 'json'});
        assert.equal(resp.body.breweries.length, 1);
        console.log('Success!');
    } catch (ex) {
        console.error(ex);
        if (ex.response) {
            console.error(ex.response.body);
        }
        process.exit(1);
    }
}


run();