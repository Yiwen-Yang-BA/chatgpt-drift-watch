# Drift Watch

对比基准与当前数据，查看字段、缺失率和分布如何变化。所有分箱与阈值清楚展示。

- 两份 CSV 的字段增减与共同列对比
- 固定基准分箱的 PSI 与原始 TV 距离
- 缺失率、数值摘要和类别分布对照
- 提示小样本及类型问题，导出独立报告

![Desktop preview](docs/preview.png)

## 快速开始

需要 Node.js 24 或更新版本；无第三方运行依赖，无需 npm install。

```sh
git clone https://github.com/Yiwen-Yang-BA/chatgpt-drift-watch.git
cd chatgpt-drift-watch
npm start
```

打开 http://127.0.0.1:3204 。默认进入**本地分析模式**，不调用 API；统计值由本地代码计算。示例数据为人工构造，界面明确标注。

### 接入真实模型

复制 `.env.example` 为 `.env`，填写 `OPENAI_API_KEY`，按账号权限设置 `OPENAI_MODEL`，然后重启服务并切换界面中的「AI 解读」。`OPENAI_BASE_URL` 必须支持 OpenAI Responses API；仅兼容 Chat Completions 的服务不适用。密钥只在服务端读取，不写入前端或仓库。

```sh
# Docker（可选；必须显式传入配置）
docker build -t chatgpt-drift-watch .
docker run --rm -p 127.0.0.1:3204:3204 --env-file .env chatgpt-drift-watch
```

## 使用方法

1. 在左侧放入基准 CSV，右侧放入当前 CSV，或载入构造示例。
2. 选择数值分箱数后开始比较；边界始终由基准数据确定。
3. 点击共同字段，核对双方占比、缺失变化和类型提示。
4. 导出 HTML/JSON 报告，结合采样范围和业务背景进一步检查。

## 计算口径

数值分箱使用基准线性插值分位点，端部覆盖所有取值；常量基准使用小于/等于/大于三个桶。缺失独立成桶。类别先去首尾空白，再取双方并集，超过 50 类不评分。各桶概率统一加 ε=0.000001 后归一：PSI=Σ(q−p)×ln(q/p)；原始 TV 距离=0.5×Σ|q−p|。PSI 0.10/0.25 仅为本工具启发分级，不是显著性检验，不等同模型性能或因果变化。任一侧少于 100 行会提示小样本。两份 CSV 合计最多 250,000 字符。口径为独立设计，参见 [Evidently 官方说明](https://docs.evidentlyai.com/metrics/explainer_drift)。

## 验证

```sh
npm run check
npm test
```

测试覆盖业务规则以及本地 HTTP 服务、模拟模型接口、输入校验和错误处理。真实付费模型调用需要用户配置有效密钥，未将本地分析测试作为真实模型质量验证。GitHub Actions 在每次推送时运行检查。

## 参考与复刻范围

灵感来自 [evidentlyai/evidently](https://github.com/evidentlyai/evidently)（Apache-2.0）。查询快照：2026-10-04；7,966 stars；最近推送 2026-09-29。这是当前星标量与更新状态，**不是近一个月新增星标排名**。

本仓库是对其核心交互和用途的独立轻量实现，未复制上游源码、商标或静态资源，不声称实现上游的全部功能，也不属于上游官方产品。

独立复刻基准 CSV 与当前 CSV 的离线漂移对比，展示缺失率、数值分布、类别占比变化及使用固定分箱规则的 PSI 等指标，并说明阈值和样本量。提供报告导出，不搭建在线监控服务，不将分布变化直接等同于模型失效或因果变化。

## 模型接收的数据

AI 只接收各列分数、缺失率和数值摘要，不发送原始行、类别标签或分箱占比表。

## 数据与部署边界

两份数据只用于当前页面的比较，不持久保存，不修改原始文件。 本地分析数据不离开本机；AI 解读仅发送本项目 README 说明的统计摘要到所配置的模型服务。

默认只监听 127.0.0.1，适用于单人本地使用；没有多用户登录或持久数据库。如需公网部署，请先增加身份验证、配额和 HTTPS。服务限制请求大小、并发和超时，禁止从静态目录读取密钥文件。

接口实现依据 [OpenAI 官方文本生成文档](https://developers.openai.com/api/docs/guides/text)。

## License

MIT — independent implementation.
