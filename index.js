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

// CREATE ORDER
client.on(Events.MessageCreate, async (message) => {
  if (!message.content.startsWith('!order')) return;

  const text = message.content.replace('!order', '').trim();

  const embed = new EmbedBuilder()
    .setColor(0x2b2d31)
    .setTitle('🛒 Order')
    .setDescription(text)
    .addFields({ name: 'Status', value: 'undone' })
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

// HANDLE STATUS CHANGE
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isStringSelectMenu()) return;
  if (interaction.customId !== 'status-select') return;

  const selected = interaction.values[0];

  const embed = EmbedBuilder.from(interaction.message.embeds[0]);

  const creatorId = embed.data.footer.text.replace('Created by ', '');

  // ONLY CREATOR CAN CHANGE
  if (interaction.user.id !== creatorId) {
    return interaction.reply({
      content: "❌ You can't change this order.",
      ephemeral: true
    });
  }

  // UPDATE STATUS
  const newEmbed = EmbedBuilder.from(embed)
    .spliceFields(0, 1, {
      name: 'Status',
      value: selected
    });

  // LOCK IF DONE
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
