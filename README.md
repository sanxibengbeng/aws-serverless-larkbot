# DynamoDB Tables Structure

The application uses three DynamoDB tables:

1. **Messages Table (`lark_messages`)**: 
   - Primary key: `chat_id` (String)
   - TTL attribute: `expire_at`
   - Purpose: Stores conversation history and system prompts for each chat
   - Key fields:
     - `chat_id`: Unique identifier for the chat
     - `messages`: JSON string containing conversation history
     - `system_prompt`: JSON string containing the system prompt
     - `expire_at`: TTL timestamp (24 hours from creation)

2. **Stats Table (`lark_stats`)**: 
   - Primary key: `app_id` (String)
   - Purpose: Tracks token usage statistics for the application
   - Key fields:
     - `app_id`: Lark application ID
     - `tokens`: JSON string containing input and output token counts

3. **Events Table (`lark_events`)**: 
   - Primary key: `event_id` (String)
   - TTL attribute: `expire_at`
   - Purpose: Tracks processed events to prevent duplicate processing
   - Key fields:
     - `event_id`: Unique event identifier from Lark
     - `header_data`: JSON string containing event header information
     - `expire_at`: TTL timestamp (24 hours from creation)

## Table Relationships

- The **Messages Table** stores conversation data keyed by `chat_id`
- The **Stats Table** tracks token usage statistics keyed by `app_id`
- The **Events Table** prevents duplicate event processing by tracking `event_id`

## Environment Variables

The table names are configured through environment variables:
- `DB_TABLE`: Messages table name
- `DB_STATS_TABLE`: Stats table name
- `DB_EVENTS_TABLE`: Events table name

## 飞书机器人需要的权限
| 权限代号 | 权限名称 |
| --- | --- |
| im:message | 获取与发送单聊、群组消息 |
| im:message.group_at_msg:readonly | 接收群聊中@机器人消息事件 |
| im:message.p2p_msg:readonly | 读取用户发给机器人的单聊消息 |
| im:message:send_as_bot | 以应用的身份发消息 |
| im:resource | 获取与上传图片或文件资源 |