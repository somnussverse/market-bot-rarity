const express = require('express');
const app = express();

// Keep-alive web server
app.get('/', (req, res) => res.send('Bot is online!'));
app.listen(3000, () => console.log('Web server active.'));

const { 
    Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, 
    StringSelectMenuBuilder, Events, SlashCommandBuilder, REST, Routes 
} = require('discord.js');

// These grab your secrets from Render's "Environment" tab
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Register /box and /divider
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
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

client.once(Events.ClientReady, async () => {
    console.log(`Logged in as ${client.user.tag}`);
    try {
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log('Slash commands synced.');
    } catch (err) { console.error(err); }
});

// Handle / commands
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'box') {
        const raw = interaction.options.getString('content');
        const color = interaction.options.getString('color') || '#B2EBF2';
        const embeds = raw.split('|').map(section => {
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
        await interaction.reply({ embeds: [new EmbedBuilder().setImage(url).setColor('#B2EBF2')] });
    }
});

// Handle !order commands
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.content.startsWith('!order')) return;

  const args = message.content.slice(7).trim();
  let buyer = message.author.username, payment = 'N/A', order = args || 'No details';

  if (args.includes('#')) {
    args.split('#').slice(1).forEach(part => {
      const [k, ...v] = part.split('=');
      const val = v.join('=').trim();
      if (k === 'buyer') buyer = val;
      if (k === 'payment') payment = val;
      if (k === 'order') order = val;
    });
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

  const menu = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('status-select')
      .addOptions([
        { label: 'undone', value: 'undone' },
        { label: 'in making', value: 'in making' },
        { label: 'done', value: 'done' }
      ])
  );

  await message.channel.send({ embeds: [embed], components: [menu] });
});

// Handle Status Menu
client.on(Events.InteractionCreate, async (int) => {
  if (!int.isStringSelectMenu() || int.customId !== 'status-select') return;
  const embed = EmbedBuilder.from(int.message.embeds[0]);
  const creatorId = embed.data.footer.text.split(' ').pop();

  if (int.user.id !== creatorId) return int.reply({ content: "Not your order!", ephemeral: true });

  embed.spliceFields(3, 1, { name: 'Status', value: int.values[0] });
  await int.update({ embeds: [embed] });
});

client.login(TOKEN);
