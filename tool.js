export function toolDefinition(repository) {
  return {
    name: 'qinglan_theme',
    description: '读取或修改当前 Harness 的青岚外观。设置在 Host 持久保存并由各页面共享，返回版本号和配色/图片引用，不返回图片内容。先 read 获取 expectedRevision；并发冲突不会覆盖新设置。reset 恢复默认并移除当前背景，执行前须得到用户明确要求。',
    parameters: {
      type: 'object', additionalProperties: false,
      properties: {
        action: { type: 'string', enum: ['read', 'update', 'reset'] },
        expectedRevision: { type: 'integer', minimum: 0, description: 'update/reset 必填：最近 read 返回的 revision。' },
        patch: { type: 'object', additionalProperties: false, description: '仅 update；省略的设置保持原值。', properties: {
          enabled: { type: 'boolean' },
          palette: { type: 'string', enum: ['green','apricot','forest','sky','lavender','rose','mint','silver','midnight','plum','coffee','graphite'] },
          opacity: { type: 'integer', minimum: 0, maximum: 25 }, blur: { type: 'integer', minimum: 0, maximum: 16 },
          fit: { type: 'string', enum: ['cover', 'contain', 'repeat'] }, pattern: { type: 'boolean' },
          image: { type: 'string', description: 'PNG/JPEG/WebP data URL，解码最多3MiB；空字符串移除图片。不接受路径或远程网址。' },
          name: { type: 'string', maxLength: 200 },
        } },
      }, required: ['action'],
    },
    output: { schema: { type: 'object', additionalProperties: true }, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] },
    async execute(args) {
      if (!['read', 'update', 'reset'].includes(args?.action)) throw new Error('Unsupported theme action');
      return repository.execute(args);
    },
  };
}
