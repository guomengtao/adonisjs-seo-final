import knex from 'knex';
import { createClient } from '@libsql/client';

const { Client } = knex;

class CustomLibSQLClient extends Client {
  constructor(config: any) {
    super(config);
    // 设置dialectName
    (this as any).dialectName = 'libsql';
  }

  async acquireRawConnection() {
    const connectionConfig = this.config.connection;
    
    if (!connectionConfig) {
      throw new Error('Connection configuration is required');
    }
    
    // 处理不同类型的连接配置
    let connectionUrl = '';
    let authToken = '';
    
    if (typeof connectionConfig === 'string') {
      connectionUrl = connectionConfig;
    } else if (connectionConfig && typeof connectionConfig === 'object') {
      connectionUrl = (connectionConfig as any).url || '';
      authToken = (connectionConfig as any).authToken || '';
    } else {
      throw new Error('Invalid connection configuration');
    }
    
    // 使用 @libsql/client 包创建连接
    const client = createClient({
      url: connectionUrl,
      authToken: authToken,
    });
    
    return client;
  }

  async destroyRawConnection(connection: any) {
    if (connection && connection.close) {
      await connection.close();
    }
  }
}

export default CustomLibSQLClient;