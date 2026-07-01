export async function isGroupAdmin(ctx) {
  if (!ctx.chat || ctx.chat.type === "private") return true;
  const userId = ctx.from?.id;
  if (!userId) return false;
  try {
    const member = await ctx.api.getChatMember(ctx.chat.id, userId);
    return member.status === "creator" || member.status === "administrator";
  } catch {
    return false;
  }
}

export async function requireAdmin(ctx) {
  if (await isGroupAdmin(ctx)) return true;
  await ctx.reply("Only group admins can change MemePulse settings.");
  return false;
}
