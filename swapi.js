const http = require('http');
const https = require('https');

const armazenamento = {};
let isDebugMode = true;
let temporequisicao = 5000;
let contadorErros = 0;


const guardardadosUsados = async (endpoint) => {
    if (armazenamento[endpoint]) {
        if (isDebugMode) console.log("Using cached data for", endpoint);
        return armazenamento[endpoint];
    }

    return new Promise((resolve, reject) => {
        let data = '';
        const req = https.get(`https://swapi.dev/api/${endpoint}`, { rejectUnauthorized: false }, (res) => {
            if (res.statusCode >= 400) {
                contadorErros++;
                return reject(new Error(`Status ${res.statusCode} on ${endpoint}`));
            }

            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    armazenamento[endpoint] = parsed;
                    if (isDebugMode) {
                        console.log(`Fetched: ${endpoint}`);
                        console.log(`Cache size: ${Object.keys(armazenamento).length}`);
                    }
                    resolve(parsed);
                } catch (err) {
                    contadorErros++;
                    reject(err);
                }
            });
        });

        req.on('error', err => {
            contadorErros++;
            reject(err);
        });

        req.setTimeout(temporequisicao, () => {
            req.abort();
            contadorErros++;
            reject(new Error(`Timeout for ${endpoint}`));
        });
    });
};


let ultimopersonagemporID = 1;
let chamadapelaapi = 0;
let armazenamentototaldados = 0;



const guardardadospersonagens = async () => {
    try {
        if (isDebugMode) console.log("Starting data fetch...");
        chamadapelaapi++;

        const personagem = await guardardadospersonagens(`people/${ultimopersonagemporID}`);
        armazenamentototaldados += JSON.stringify(personagem).length;
        console.log(`\nPersonagem: ${personagem.name}, Altura: ${personagem.height}, Massa: ${personagem.mass}, Nascimento: ${personagem.birth_year}`);
        if (personagem.filmes?.length) console.log(`Appears in ${personagem.filmes.length} filmes`);

        const naves = await guardardadosUsados('starships/?page=1');
        armazenamentototaldados += JSON.stringify(naves).length;
        console.log(`\nTotal Starships: ${naves.count}`);
        naves.results.slice(0, 3).forEach((s, i) => {
            console.log(`\nStarship ${i + 1}: ${s.name}, Modelo: ${s.model}, Fabricante: ${s.manufacturer}, Custo: ${s.cost_in_credits}, Velocidade: ${s.max_atmosphering_speed}, Hiperdrive: ${s.hyperdrive_rating}, Pilotos: ${s.pilots?.length || 0}`);
        });

        const planets = await guardardadospersonagens('planets/?page=1');
        armazenamentototaldados += JSON.stringify(planets).length;
        console.log('\nPlanetas populosos e grandes:');
        planets.results.forEach(p => {
            const pop = parseInt(p.population), dia = parseInt(p.diameter);
            if (!isNaN(pop) && pop > 1e9 && !isNaN(dia) && dia > 10000) {
                console.log(`${p.name} - Pop: ${p.population}, Diâmetro: ${p.diameter}, Clima: ${p.climate}`);
            }
        });

        const filmes = await guardardadospersonagens('films/');
        armazenamentototaldados += JSON.stringify(filmes).length;
        filmes.results.sort((a, b) => new Date(a.release_date) - new Date(b.release_date)).forEach((f, i) => {
            console.log(`\n${i + 1}. ${f.title} (${f.release_date}) - Diretor: ${f.director}, Produtor: ${f.producer}`);
        });

        if (ultimopersonagemporID <= 4) {
            const veiculo = await guardardadospersonagens(`veiculos/${ultimopersonagemporID}`);
            armazenamentototaldados += JSON.stringify(veiculo).length;
            console.log(`\nVeículo: ${veiculo.name}, Modelo: ${veiculo.model}, Fabricante: ${veiculo.manufacturer}, Custo: ${veiculo.cost_in_credits}, Tamanho: ${veiculo.length}, Tripulação: ${veiculo.crew}, Passageiros: ${veiculo.passengers}`);
            ultimopersonagemporID++;
        }

        if (isDebugMode) console.log(`\nChamadas API: ${chamadapelaapi}, Cache: ${Object.keys(armazenamento).length}, Total dados: ${armazenamentototaldados} bytes, Erros: ${contadorErros}`);
    } catch (e) {
        console.error('Erro:', e.message);
        contadorErros++;
    }
};

const PORT = process.env.PORT || 3000;

const servidor = http.createServer((req, res) => {
    if (req.url === '/' || req.url === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`<!DOCTYPE html>
<html>
<head>
    <title>Star Wars API Demo</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        h1 { color: #FFE81F; background-color: #000; padding: 10px; }
        button { background-color: #FFE81F; border: none; padding: 10px 20px; cursor: pointer; }
        .footer { margin-top: 50px; font-size: 12px; color: #666; }
        pre { background: #f4f4f4; padding: 10px; border-radius: 5px; }
    </style>
</head>
<body>
    <h1>Star Wars API Demo</h1>
    <p>This page demonstrates fetching data from the Star Wars API.</p>
    <p>Check your console for the API results.</p>
    <button onclick="fetchData()">Fetch Star Wars Data</button>
    <div id="results"></div>
    <script>
        function fetchData() {
            document.getElementById('results').innerHTML = '<p>Loading data...</p>';
            fetch('/api')
                .then(res => res.text())
                .then(() => {
                    alert('API request made! Check server console.');
                    document.getElementById('results').innerHTML = '<p>Data fetched! Check server console.</p>';
                })
                .catch(err => {
                    document.getElementById('results').innerHTML = '<p>Error: ' + err.message + '</p>';
                });
        }
    </script>
    <div class="footer">
        <p>API calls: ${chamadapelaapi} | Cache entries: ${Object.keys(armazenamento).length} | Errors: ${contadorErros}</p>
        <pre>Debug mode: ${isDebugMode ? 'ON' : 'OFF'} | Timeout: ${temporequisicao}ms</pre>
    </div>
</body>
</html>`);
    } else if (req.url === '/api') {
        guardardadospersonagens();
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Check server console for results');
    } else if (req.url === '/stats') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            api_calls: chamadapelaapi,
            armazenamento_entradas: Object.keys(armazenamento).length,
            total_data_size: armazenamentototaldados,
            errors: contadorErros,
            debug_mode: isDebugMode,
            timeout: temporequisicao
        }));
    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
    }
});

servidor.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
    console.log('Open the URL in your browser and click the button to fetch Star Wars data');
    if (isDebugMode) {
        console.log('Debug mode: ON');
        console.log('Timeout:', temporequisicao, 'ms');
    }
});
