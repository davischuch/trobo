const { Client: WWebClient, LocalAuth, MessageAck } = require('whatsapp-web.js');
const { Client: NotionClient } =  require('@notionhq/client');
const qrcode = require('qrcode-terminal');
const moment = require('moment');
require('dotenv').config();

const notion = new NotionClient({auth: process.env.NOTION_KEY});
const art = "``` _           _       \n| |_ ___ ___| |_ ___ \n|  _|  _| . | . | . |\n|_| |_| |___|___|___|\n                 v0.2\n```"

async function retrieveAll() {
    const titles = ['*As datas presentes no TROnograma são:*'];
    let dateCurr = moment().format().slice(0, 10);
    
    const data = await notion.databases.query({
        database_id: process.env.NOTION_DATABASE_ID,
        filter: {
            property: 'Date',
            date: {
                on_or_after: dateCurr
            }
        },
        sorts: [{
            property: 'Date',
            direction: 'ascending'
        }]
    });
    data.results.map((page) => {
        page.properties.Name.title.map((item) => {
            let dateItem = moment(page.properties.Date.date.start).format('DD/MM/YYYY');
            titles.push('\n - ' + item.plain_text + ' (' + dateItem + ')')
        })
    })
    return titles.toString();
}

async function retrieveMonth() {
    const titles = ['*As datas do próximo mês são:*'];
    
    const data = await notion.databases.query({
        database_id: process.env.NOTION_DATABASE_ID,
        filter: {
            property: 'Date',
            date: {
                next_month: {}
            }
        },
        sorts: [{
            property: 'Date',
            direction: 'ascending'
        }]
    });
    data.results.map((page) => {
        page.properties.Name.title.map((item) => {
            let dateItem = moment(page.properties.Date.date.start).format('DD/MM/YYYY');
            titles.push('\n - ' + item.plain_text + ' (' + dateItem + ')')
        })
    })
    return titles.toString();
}

async function createPage(title, date) {
    await notion.pages.create({
        parent: {
            type: "database_id",
            database_id: process.env.NOTION_DATABASE_ID
        },
        properties: {
            "Name": {
                title: [{
                    text: {
                        content: title
                    }
                }]
            },
            "Date": {
                date: {
                    start: moment(date, "DD-MM-YYYY").format().slice(0, 10)
                }
            }
        }
    })
}

async function main() {
    const initialMsg= `   
📆 Seja bem vindo ao 🌪️
${art}
Digite o número correspondente para acessar uma função:
                            
    *1*. Liste as datas dos próximos 30 dias
    *2*. Liste todas as datas
    *3*. Adicione datas
`
    let state = 'clear'
    let active = 'no'
    let title, date

    const client = new WWebClient({
        authStrategy: new LocalAuth(),
        puppeteer: {
            headless: true,
            args: ['--no-sandbox']
        }
    });
    client.once('ready', () => {
        console.log('Client is ready!');
    });
    client.on('qr', (qr) => {
        qrcode.generate(qr, {small: true});
    });
    client.initialize();

    client.on('message_create', async message => {
        if (!message.fromMe) {
            if (active == 'no') {
                if (message.body === 'Tronograma') {
                    client.sendMessage(message.from, initialMsg);
                    active = 'yes'
                }
            }
            if (active == 'yes') {
                if (state == 'clear') {
                    if (message.body === '1') {
                        const response = await retrieveMonth();
                        const string = response.split(',').join(' ');
                        client.sendMessage(message.from, `${art}\n${string}`);
                        active = 'no'
                    }
                    if (message.body === '2') {
                        const response = await retrieveAll();
                        const string = response.split(',').join(' ');
                        client.sendMessage(message.from, `${art}\n${string}`);
                        active = 'no'
                    }
                    if (message.body === '3') {
                        state = 'add title'
                        client.sendMessage(message.from, `${art}\n*Digite o título do evento*`);
                    }
                } else if (state == 'add title') {
                    title = message.body
                    client.sendMessage(message.from, `${art}\n*Digite a data do evento*\nFormato DD/MM (Ex.: 31/12)`);
                    state = 'add date'
                } else if (state == 'add date') {
                    date = message.body
                    client.sendMessage(message.from, `${art}\n*Os dados estão corretos?*\n\nTítulo: ${title}\nData: ${date}\n\nSim (*s*) - Não (*n*)`);
                    state = 'date waiting response'
                } else if (state == 'date waiting response') {
                    if (message.body == 's' || message.body == 'S') {
                        if (!moment(date, "DD-MM-YYYY").isValid()) {
                            client.sendMessage(message.from, `${art}\nFormato de data inválido\n*Processo encerrado!*`);
                            state = 'clear'
                            active = 'no'
                        } else {
                            await createPage(title, date)
                            client.sendMessage(message.from, `${art}\n*Data adicionada com sucesso!*`);
                            state = 'clear'
                            active = 'no'
                        }
                    } else if (message.body == 'n' || message.body == 'N') {
                        client.sendMessage(message.from, `${art}\n*Processo cancelado!*`);
                        state = 'clear'
                        active = 'no'
                    }
                }
            }
        }
    });
}
main();