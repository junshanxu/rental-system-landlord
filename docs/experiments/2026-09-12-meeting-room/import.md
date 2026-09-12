# 现代办公会议室导入记录

2026-09-12。按用户提供的 [Aholo 分享页](https://studio.aholo3d.com/viewer?projectId=3FO4K4VCF7LG) 导入已有结果。

- 项目编号：`3FO4K4VCF7LG`。
- 平台名称：`Modern Office Meeting Room`；界面名称：现代办公会议室。
- Aholo `world_get(region=com)` 返回 `SUCCEEDED`、进度 1；分享页的项目详情也返回相同模型资产。
- 场景为 indoor，原始坐标为 Z 轴向上。这里只读取、下载已有资产，没有新建、重建或生成任务。
- 输入素材不属于本应用采集，未写入用户草稿、素材或重建任务；质量仍待人工验收。

## 文件与恢复

模型存放于本仓库的 `outputs/aholo/3FO4K4VCF7LG/`，该目录被 Git 忽略。新克隆环境可从以下已核对来源下载原文件，按表中名称放入此目录后刷新应用。应用本地预览不需要再次调用 Aholo API，也不需要下载原始拍摄素材。

| 文件 | 字节数 | 下载来源 |
| --- | ---: | --- |
| `meeting-room.spz` | 6,733,394 | [平台 SPZ](https://holo-cos.aholo3d.cn/3dgs/2026/9/12/3dgs-common/3FO4FKQ46FL9/e7fe457f8f614eaa94bf02c70d83c2e7_point_cloud_compressed.spz) |
| `meeting-room.ply` | 85,156,177 | [平台 PLY](https://holo-cos.aholo3d.cn/3dgs-common/3FO4FKQ46FL9/2026/9/12/e7fe457f8f614eaa94bf02c70d83c2e7_point_cloud.ply) |

下载后核对了响应长度、本地字节数与文件头。SPZ 解压后为 NGSP v2，360,825 个高斯点；PLY 为 binary_little_endian，顶点数相同。SHA-256：

```text
meeting-room.spz  d400901a69ba5d9038720126283fd4dd3af52df5aee1e5d7b463e94d5fc8d0df
meeting-room.ply  acc15aaaae5c3c2d572b9d2204d59619709256016ea7e2805b8bddeda1c8184b
```

## 初始视角

平台的 [分享相机配置](https://studio.aholo3d.com/holo/project/data/share/v2/3FO4K50476RR) 提供以下 Z-up 坐标：

```json
{
  "position": [2.09142, 0.78628504, -0.14368024],
  "target": [1.6183219, 0.8178654, -0.13051295]
}
```

查看器对模型与相机点使用相同的坐标转换，保持 Y 轴向上。会议室从室内视角打开，“初始点”、R 和“初始视角”选项都恢复此位置与看向点。正面、侧面、俯视仍是模型中心的固定观察方向；它们不代表实拍机位。这里没有读取或复制平台的碰撞边界。

## 接入位置

`server/samples.mjs` 维护固定样例目录、来源与初始相机；`server/app.mjs` 提供登录保护的 `/api/samples/:id/model.spz`、`model.ply`，支持范围读取与下载。请求中的路径不能成为任意本地文件路径。`src/app.js` 提供样例选择，会议室优先，缺失时选择其他可用样例；旧工作台及旧下载接口保留。

核验记录见 [MVP 验证记录](../../MVP验证记录-20260912.md)。平台任务完成、文件可加载和模型质量验收是不同状态，当前未输出质量通过结论。
