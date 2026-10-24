migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  users.passwordAuth = { enabled: true, identityFields: ["email"] };
  users.createRule = 'verified = false && @request.body.verified:isset = false';
  users.fields.getByName("password").min = 12;
  users.verificationTemplate = {
    subject: "验证你的要事图邮箱",
    body: '<p>请点击链接验证邮箱：</p><p><a href="{APP_URL}/#verify/{TOKEN}">验证邮箱</a></p><p>如果不是你发起的请求，请忽略此邮件。</p>',
  };
  users.resetPasswordTemplate = {
    subject: "重设你的要事图密码",
    body: '<p>请点击链接设置新密码：</p><p><a href="{APP_URL}/#reset/{TOKEN}">重设密码</a></p><p>如果不是你发起的请求，请忽略此邮件。</p>',
  };
  app.save(users);
}, (app) => {
  const users = app.findCollectionByNameOrId("users");
  users.passwordAuth = { enabled: false, identityFields: ["email"] };
  users.createRule = null;
  app.save(users);
});
