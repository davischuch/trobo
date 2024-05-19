const { Client: WWebClient, LocalAuth, MessageAck } = require('whatsapp-web.js');
const { Client: NotionClient } =  require('@notionhq/client');
const qrcode = require('qrcode-terminal');
const moment = require('moment');
require('dotenv').config();

const notion = new NotionClient({auth: process.env.NOTION_KEY});

async function retrieveAll() {
    const titles = ['As datas presentes no TROnograma são:'];
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
    const titles = ['As datas do próximo mês são:'];
    
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

async function main() {
    const initialMsg = 
`   
📆 *TRÔbo* 🌪️
Digite o número correspondente para acessar uma função:
                            
    1. Liste as datas dos próximos 30 dias
    2. Liste todas as datas
`

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
        if (message.body === 'Tronograma') {
            client.sendMessage(message.from, initialMsg);
        }
        if (message.body === '1') {
            const response = await retrieveMonth();
            const string = response.split(',').join(' ');
            client.sendMessage(message.from, string);
        }
        if (message.body === '2') {
            const response = await retrieveAll();
            const string = response.split(',').join(' ');
            client.sendMessage(message.from, string);
        }
    });
}
main();