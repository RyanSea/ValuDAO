const {
    bot, 
    valu, 
    arbValu,
    meterValu,
    token, 
    ethers, 
    hermes, 
    airdrop,
    airdrop_address,
    wc_engagement, 
    wc_token, 
    wcSigner, 
    wcProvider,
    MessageActionRow, 
    MessageButton,
    MessageEmbed,
    MessageAttachment,
    //abi,
    ValuBot
} = require('./utils/initialize.js')

const {createSphere, tokenize} = require('./utils/utils')
const express = require('express');
const {defaultAbiCoder} = require('@ethersproject/abi')
const { keccak256 } =  require("@ethersproject/solidity")
var qr = require('qr-image');

const myEoa = '0xf5f0835DE49B6D288a180865014289A35D07c5e5'


const mumbaiURL = "https://mumbai.polygonscan.com/token/"
//const arbitrumURL = "https://testnet.arbiscan.io/token/"
const meterURL = "https://scan-warringstakes.meter.io/address/"


var qr_png
wcProvider.connector.on("display_uri", async (err, payload) => {
    //console.log(payload)
    let code = payload.params[0]
    qr_png = qr.image(code, { type: 'png' });
});

wcProvider.connector.on('session_request', async (err, payload) => {
    console.log("Session Request:", payload)
})


bot.on('ready', async () => {
    console.log('Valu Bot Here!')
    
})


bot.on('messageCreate',async  msg => {
    let address, isAuthenticated, id, bal, profile, amount, name, symbol;

    if (msg.content.startsWith('!create')) {

        [name,symbol] = tokenize(msg.content)

        let tx = await valu.create(msg.guildId, name, symbol)
        //let txArb = await arbValu.create(msg.guildId, name, symbol)
        let txMeter = await meterValu.create(msg.guildId, name, symbol)
        
        let networkChan = msg.channel //guild.channels.cache.find(channel => channel.name === "sphere-address")

        await tx.wait()
        let mumbaiSphere = (await valu.spheres(msg.guildId)).sphere
        await networkChan.send(`Mumbai: <${mumbaiURL + mumbaiSphere}>`) 

        await txMeter.wait()
        let meterSphere = (await meterValu.spheres(msg.guildId)).sphere
        await networkChan.send(`Meter: <${meterURL + meterSphere}>`) 
    }

    if (msg.content.startsWith('!auth')) {

        address = await valu.getAddress(msg.guildId, msg.author.id)
        address = await meterValu.getAddress(msg.guildId, msg.author.id)

        
        if (address === ethers.constants.AddressZero){
            const row = new MessageActionRow()
                .addComponents(
                    new MessageButton()
                        .setCustomId('walletconnect')
                        .setLabel('WalletConnect')
                        .setStyle('PRIMARY')
                        .setEmoji('974755262567153675'),
                    new MessageButton()
                        .setCustomId('coinbase')
                        .setLabel('Coinbase')
                        .setStyle('PRIMARY')
                        .setEmoji('974754753475121162')
                );

            await msg.reply({ content: 'Choose wallet provider', components: [row] });
        } else {
            await msg.reply('Already authenticated!')
        }

    }

    if (msg.content.startsWith('!power')) {
        amount = msg.content.split(' ')[1]
        if(isNaN(amount)) {
            msg.reply('Enter a valid number after the command e.g.: `!power 500`')
        } else {
            await valu.powerUp(msg.author.id, ethers.utils.parseEther(amount))
            await msg.reply('Successfully powered up!')
        }
    }

    if (msg.content.startsWith('!unpower')) {
        amount = msg.content.split(' ')[1]
        if(isNaN(amount)) {
            msg.reply('Enter a valid number after the command e.g.: `!power 500`')
        } else {
            amount = ethers.utils.parseEther(amount)

            await valu.powerDown(msg.guildId, msg.author.id, amount, {gasLimit: 10000000})
            await msg.reply('Successfully powered down!')
        }
    }

    if (msg.content.startsWith('!claim')) {


        const actionID = defaultAbiCoder.encode(["uint256"], [BigInt(keccak256(["bytes"], [airdrop_address])) >> BigInt(8)]) 
        const signal =  await valu.getAddress(msg.guildId, msg.author.id)
        const myServer = "https%3A%2F%2Fef7a-2601-643-8300-f4b0-98f0-7a80-93e0-790b.ngrok.io%2Fhook"
        const link = `https://id.worldcoin.org/use?actionId=${actionID}&signal=${signal}&returnTo=` + myServer
        const app = express()
        console.log(signal)

        app.listen(6969)

        let claimMsg = msg.reply(link)

        app.get("/hook", async (req, res) => {
            const merkleRoot = req.query.merkleRoot
            const nullifierHash = req.query.nullifierHash
            const proof = defaultAbiCoder.decode(["uint256[8]"], req.query.proof)[0]
            
            await valu.claim(
                msg.guildId,
                signal, 
                merkleRoot, 
                nullifierHash, 
                proof, 
                {gasLimit: 10000000}
            )
            await (await claimMsg).edit("Claim successful!")
            res.send("World ID Verification Success! Return to Discord!")

            res.status(200).end() 
        })
    }

    

})

bot.on('interactionCreate', async interaction => {
	if (!interaction.isButton()) return;
	
    if(interaction.customId === "walletconnect") {
        let id = interaction.member.id;

        await wcProvider.connector.createSession() 
        let qrCode = new MessageAttachment(qr_png)
        let msg = interaction.message;
        msg.edit({content:"\u200b",files: [qrCode], components: []})

        wcProvider.connector.on('connect', async (err, payload) => {
            address = payload.params[0].accounts[0]
            await valu.authenticate(msg.guildId, id, address)
            //await arbValu.authenticate(msg.guildId, id, address)
            //await meterValu.authenticate(msg.guildId, id, address)
            await msg.edit({content: "Connected!", files: []})
            await wcProvider.disconnect()
        })
    }
});

bot.on('messageReactionAdd', async (reaction, user) => {

    if(user.bot) return

    let engager = user.id

    let engagee = reaction.message.author.id;
    let msg = reaction.message;

    let engager_auth = await valu.getAddress(msg.guildId,engager)
    let engagee_auth = await valu.getAddress(msg.guildId,engagee)
    // let engager_auth = await meterValu.getAddress(msg.guildId,engager)
    // let engagee_auth = await meterValu.getAddress(msg.guildId,engagee)
    if(engager_auth !== ethers.constants.addressZero && ethers.constants.AddressZero !== engagee_auth) {
        await valu.engage(msg.guildId,engager, engagee)
        //await arbValu.engage(msg.guildId,engager, engagee)
        await meterValu.engage(msg.guildId,engager, engagee)
    }
    
})

bot.login(hermes)