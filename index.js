const express = require('express');
const app = express();
const https = require('https');

// ---------------- WEB SERVER & SELF-PING ----------------
app.get('/', (req, res) => {
    res.send('Market Bot is awake and running!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Web server is ready on port ${PORT}.`);
    
    // This visits your bot's own URL every 10 minutes to stay awake
    setInterval(() => {
        // Replace 'your-bot-name' with your actual Render URL name
        // Example: https://market-bot-rarity.onrender.com
        const url = `https://${process.env.RENDER_EXTERNAL_HOSTNAME || 'your-bot-name'}.onrender.com`; 
        https.get(url, (res) => {
            console.log('Self-ping successful: Status', res.statusCode);
        }).on('error', (e) => {
            console.error('Self-ping failed:', e.message);
        });
    }, 600000); 
});

const { 
    Client, 
    GatewayIntentBits, 
    EmbedBuilder, 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    Events, 
    SlashCommandBuilder, 
    REST, 
    Routes 
} = require('discord.js');

// ---------------- ENV VARIABLES ----------------
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ---------------- SLASH COMMAND SETUP ----------------
const commands = [
    new SlashCommandBuilder()
        .setName('box')
        .setDescription('Create multiple boxed embeds')
        .addStringOption(opt => opt.setName('content').setDescription('Title: Text | Title2: Text2').setRequired(true))
        .addStringOption(opt => opt.setName('color').setDescription('Hex color (e.g. #B2EBF2)')),
    new SlashCommandBuilder()
        .setName('divider')
        .setDescription('Send a divider image box')
        .addStringOption(opt => opt.setName('image_url').setDescription('Link to divider image').setRequired(true))
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

client.once(Events.ClientReady, async () => {
    console.log(`Logged in as ${client.user.tag}`);
    try {
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log('Slash commands registered.');
    } catch (error) {
        console.error('Error registering commands:', error);
    }
});

// ---------------- BOX & DIVIDER HANDLER ----------------
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'box') {
        const rawContent = interaction.options.getString('content');
        const color = interaction.options.getString('color') || '#B2EBF2';
        const sections = rawContent.split('|');
        
        const embeds = sections.slice(0, 10).map(section => {
            const [title, ...body] = section.split(':');
            return new EmbedBuilder()
                .setTitle(title.trim())
                .setDescription(body.join(':').trim() || '\u200B')
                .setColor(color.startsWith('#') ? color : `#${color}`);
        });
        await interaction.reply({ embeds: embeds });
    }

    if (interaction.commandName === 'divider') {
        const url = interaction.options.getString('image_url');
        const embed = new EmbedBuilder().setImage(url).setColor('#B2EBF2');
        await interaction.reply({ embeds: [embed] });
    }
});

// ---------------- !ORDER HANDLER ----------------
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.content.startsWith('!order')) return;

  let buyer = message.author.username;
  let payment = 'Not specified';
  let order = 'No details provided';

  const args = message.content.slice('!order'.length).trim();

  if (args.includes('#')) {
    const parts = args.split('#').slice(1);
    parts.forEach(part => {
      const [key, ...value] = part.split('=');
      const val = value.join('=').trim();
      if (!val) return;
      if (key.toLowerCase() === 'buyer') buyer = val;
      if (key.toLowerCase() === 'payment') payment = val;
      if (key.toLowerCase() === 'order') order = val;
    });
  } else {
    order = args || order;
  }

  const embed = new EmbedBuilder()
    .setColor(0x2b2d31)
    .setTitle('🛒 Order')
    .addFields(
      { name: 'Buyer', value: buyer },
      { name: 'Payment', value: payment },
      { name: 'Order', value: order },
      { name: 'Status', value: 'undone' }
    )
    .setFooter({ text: `Created by ${message.author.id}` });

  const menu = new StringSelectMenuBuilder()
    .setCustomId('status-select')
    .setPlaceholder('Select status...')
    .addOptions([
      { label: 'undone', value: 'undone' },
      { label: 'in making', value: 'in making' },
      { label: 'done', value: 'done' },
      { label: 'cancelled', value: 'cancelled' }
    ]);

  const row = new ActionRowBuilder().addComponents(menu);
  await message.channel.send({ embeds: [embed], components: [row] });
});

// ---------------- STATUS SELECTOR HANDLER ----------------
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isStringSelectMenu() || interaction.customId !== 'status-select') return;

  const selected = interaction.values[0];
  const embed = EmbedBuilder.from(interaction.message.embeds[0]);
  const footerText = embed.data.footer.text;
  const creatorId = footerText.split(' ').pop();

  if (interaction.user.id !== creatorId) {
    return interaction.reply({ content: "❌ You can't change this order status.", ephemeral: true });
  }

  const newEmbed = EmbedBuilder.from(embed);
  const index = newEmbed.data.fields.findIndex(f => f.name === 'Status');
  if (index !== -1) {
    newEmbed.spliceFields(index, 1, { name: 'Status', value: selected });
  }

  const disabled = (selected === 'done' || selected === 'cancelled');
  const menu = StringSelectMenuBuilder.from(interaction.component).setDisabled(disabled);
  const row = new ActionRowBuilder().addComponents(menu);

  await interaction.update({ embeds: [newEmbed], components: [row] });
});

client.login(TOKEN);
