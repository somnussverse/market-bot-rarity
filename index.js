const express = require('express');
const app = express();

// 1. WEB SERVER (Keeps the bot alive on Render)
app.get('/', (req, res) => {
  res.send('Bot is online!');
});

app.listen(3000, () => {
  console.log('Web server is ready on port 3000.');
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

// --- CONFIGURATION ---
const TOKEN = 'PASTE_YOUR_TOKEN_HERE';
const CLIENT_ID = 'PASTE_YOUR_APPLICATION_ID_HERE';
// ---------------------

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// 2. SLASH COMMAND REGISTRATION
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
        console.log('Slash commands registered successfully.');
    } catch (error) {
        console.error('Error registering commands:', error);
    }
});

// 3. SLASH COMMAND HANDLER (Box & Divider)
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'box') {
        const rawContent = interaction.options.getString('content');
        const color = interaction.options.getString('color') || '#B2EBF2';
        const sections = rawContent.split('|');
        
        const embeds = sections.map(section => {
            const [title, ...body] = section.split(':');
            return new EmbedBuilder()
                .setTitle(title.trim())
                .setDescription(body.join(':').trim() || '\u200B')
                .setColor(color);
        });
        await interaction.reply({ embeds: embeds.slice(0, 10) });
    }

    if (interaction.commandName === 'divider') {
        const url = interaction.options.getString('image_url');
        const embed = new EmbedBuilder().setImage(url).setColor('#B2EBF2');
        await interaction.reply({ embeds: [embed] });
    }
});

// 4. MESSAGE COMMAND HANDLER (!order)
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

// 5. STATUS UPDATE HANDLER (Menu)
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isStringSelectMenu() || interaction.customId !== 'status-select') return;

  const selected = interaction.values[0];
  const embed = EmbedBuilder.from(interaction.message.embeds[0]);
  const creatorId = embed.data.footer.text.replace('Created by ', '');

  if (interaction.user.id !== creatorId) {
    return interaction.reply({ content: "❌ You can't change this order.", ephemeral: true });
  }

  const newEmbed = EmbedBuilder.from(embed);
  const index = newEmbed.data.fields.findIndex(f => f.name === 'Status');
  if (index !== -1) {
    newEmbed.spliceFields(index, 1, { name: 'Status', value: selected });
  }

  const disabled = selected === 'done';
  const menu = StringSelectMenuBuilder.from(interaction.component).setDisabled(disabled);
  const row = new ActionRowBuilder().addComponents(menu);

  await interaction.update({ embeds: [newEmbed], components: [row] });
});

client.login(TOKEN);
