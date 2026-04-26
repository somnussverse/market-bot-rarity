const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('Bot is online and stays awake!');
});

app.listen(3000, () => {
  console.log('Web server is ready.');
});

const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  Events
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once(Events.ClientReady, () => {
  console.log(`Bot online as ${client.user.tag}`);
});


client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  console.log("Triggered once");

  console.log("MESSAGE:", message.content);

  if (!message.content.startsWith('!order')) return;


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

  await message.channel.send({
    embeds: [embed],
    components: [row]
  });
});


client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isStringSelectMenu()) return;
  if (interaction.customId !== 'status-select') return;

  const selected = interaction.values[0];
  const embed = EmbedBuilder.from(interaction.message.embeds[0]);

  const creatorId = embed.data.footer.text.replace('Created by ', '');


  if (interaction.user.id !== creatorId) {
    return interaction.reply({
      content: "❌ You can't change this order.",
      ephemeral: true
    });
  }

  const newEmbed = EmbedBuilder.from(embed);


  const index = newEmbed.data.fields.findIndex(f => f.name === 'Status');

  if (index !== -1) {
    newEmbed.spliceFields(index, 1, {
      name: 'Status',
      value: selected
    });
  }


  const disabled = selected === 'done';

  const menu = StringSelectMenuBuilder.from(interaction.component)
    .setDisabled(disabled);

  const row = new ActionRowBuilder().addComponents(menu);

  await interaction.update({
    embeds: [newEmbed],
    components: [row]
  });
});

client.login(process.env.TOKEN);
