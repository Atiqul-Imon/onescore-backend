import { Client } from 'elasticsearch';
import { logger } from './logger';

const ELASTICSEARCH_URL = process.env.ELASTICSEARCH_URL || 'http://localhost:9200';

// Create Elasticsearch client
export const esClient = new Client({
  host: ELASTICSEARCH_URL,
  log: 'error',
  maxRetries: 3,
  requestTimeout: 30000,
  pingTimeout: 3000,
});

export const connectElasticsearch = async (): Promise<void> => {
  try {
    // Test connection
    const ping = await esClient.ping();
    if (!ping) {
      throw new Error('Elasticsearch ping failed');
    }

    logger.info('Elasticsearch connected successfully');

    // Create indices if they don't exist
    await createIndices();
  } catch (error) {
    logger.warn('Elasticsearch connection failed (optional service):', error);
    // Don't throw error - Elasticsearch is optional for development
  }
};

// Create necessary indices
const createIndices = async (): Promise<void> => {
  try {
    // Content index
    const contentIndexExists = await esClient.indices.exists({ index: 'content' });
    if (!contentIndexExists) {
      await esClient.indices.create({
        index: 'content',
        body: {
          mappings: {
            properties: {
              title: {
                type: 'text',
                analyzer: 'standard',
                fields: {
                  keyword: {
                    type: 'keyword'
                  }
                }
              },
              content: {
                type: 'text',
                analyzer: 'standard'
              },
              type: {
                type: 'keyword'
              },
              category: {
                type: 'keyword'
              },
              tags: {
                type: 'keyword'
              },
              status: {
                type: 'keyword'
              },
              featured: {
                type: 'boolean'
              },
              views: {
                type: 'integer'
              },
              likes: {
                type: 'integer'
              },
              publishedAt: {
                type: 'date'
              },
              createdAt: {
                type: 'date'
              },
              contributor: {
                type: 'object',
                properties: {
                  id: { type: 'keyword' },
                  name: { type: 'text' },
                  email: { type: 'keyword' }
                }
              }
            }
          },
          settings: {
            number_of_shards: 1,
            number_of_replicas: 0,
            analysis: {
              analyzer: {
                custom_analyzer: {
                  type: 'custom',
                  tokenizer: 'standard',
                  filter: ['lowercase', 'stop', 'snowball']
                }
              }
            }
          }
        }
      });
      logger.info('Content index created');
    }

    // Cricket matches index
    const cricketIndexExists = await esClient.indices.exists({ index: 'cricket_matches' });
    if (!cricketIndexExists) {
      await esClient.indices.create({
        index: 'cricket_matches',
        body: {
          mappings: {
            properties: {
              matchId: { type: 'keyword' },
              series: { type: 'text' },
              teams: {
                type: 'object',
                properties: {
                  home: {
                    type: 'object',
                    properties: {
                      id: { type: 'keyword' },
                      name: { type: 'text' },
                      shortName: { type: 'keyword' }
                    }
                  },
                  away: {
                    type: 'object',
                    properties: {
                      id: { type: 'keyword' },
                      name: { type: 'text' },
                      shortName: { type: 'keyword' }
                    }
                  }
                }
              },
              venue: {
                type: 'object',
                properties: {
                  name: { type: 'text' },
                  city: { type: 'keyword' },
                  country: { type: 'keyword' }
                }
              },
              status: { type: 'keyword' },
              format: { type: 'keyword' },
              startTime: { type: 'date' },
              endTime: { type: 'date' }
            }
          }
        }
      });
      logger.info('Cricket matches index created');
    }

    // Football matches index
    const footballIndexExists = await esClient.indices.exists({ index: 'football_matches' });
    if (!footballIndexExists) {
      await esClient.indices.create({
        index: 'football_matches',
        body: {
          mappings: {
            properties: {
              matchId: { type: 'keyword' },
              league: { type: 'text' },
              season: { type: 'keyword' },
              teams: {
                type: 'object',
                properties: {
                  home: {
                    type: 'object',
                    properties: {
                      id: { type: 'keyword' },
                      name: { type: 'text' },
                      shortName: { type: 'keyword' }
                    }
                  },
                  away: {
                    type: 'object',
                    properties: {
                      id: { type: 'keyword' },
                      name: { type: 'text' },
                      shortName: { type: 'keyword' }
                    }
                  }
                }
              },
              venue: {
                type: 'object',
                properties: {
                  name: { type: 'text' },
                  city: { type: 'keyword' },
                  country: { type: 'keyword' }
                }
              },
              status: { type: 'keyword' },
              startTime: { type: 'date' },
              endTime: { type: 'date' }
            }
          }
        }
      });
      logger.info('Football matches index created');
    }

  } catch (error) {
    logger.error('Error creating Elasticsearch indices:', error);
    throw error;
  }
};

// Search functions
export const searchContent = async (query: string, filters: any = {}, size = 20, from = 0) => {
  try {
    const searchBody = {
      query: {
        bool: {
          must: [
            {
              multi_match: {
                query: query,
                fields: ['title^2', 'content'],
                type: 'best_fields',
                fuzziness: 'AUTO'
              }
            }
          ],
          filter: [
            { term: { status: 'approved' } },
            ...Object.entries(filters).map(([key, value]) => ({ term: { [key]: value } }))
          ]
        }
      },
      sort: [
        { publishedAt: { order: 'desc' } },
        { _score: { order: 'desc' } }
      ],
      size,
      from
    };

    const response = await esClient.search({
      index: 'content',
      body: searchBody
    });

    return {
      hits: response.hits.hits.map((hit: any) => ({
        ...hit._source,
        score: hit._score
      })),
      total: response.hits.total.value,
      took: response.took
    };
  } catch (error) {
    logger.error('Elasticsearch search error:', error);
    throw error;
  }
};

export const searchMatches = async (sport: string, query: string, filters: any = {}, size = 20) => {
  try {
    const index = sport === 'cricket' ? 'cricket_matches' : 'football_matches';
    
    const searchBody = {
      query: {
        bool: {
          must: [
            {
              multi_match: {
                query: query,
                fields: ['series', 'teams.home.name', 'teams.away.name', 'venue.name'],
                type: 'best_fields'
              }
            }
          ],
          filter: [
            ...Object.entries(filters).map(([key, value]) => ({ term: { [key]: value } }))
          ]
        }
      },
      sort: [
        { startTime: { order: 'desc' } }
      ],
      size
    };

    const response = await esClient.search({
      index,
      body: searchBody
    });

    return {
      hits: response.hits.hits.map((hit: any) => hit._source),
      total: response.hits.total.value
    };
  } catch (error) {
    logger.error('Elasticsearch match search error:', error);
    throw error;
  }
};

// Index document
export const indexDocument = async (index: string, id: string, document: any) => {
  try {
    await esClient.index({
      index,
      id,
      body: document
    });
    logger.info(`Document indexed in ${index}: ${id}`);
  } catch (error) {
    logger.error(`Error indexing document in ${index}:`, error);
    throw error;
  }
};

// Update document
export const updateDocument = async (index: string, id: string, document: any) => {
  try {
    await esClient.update({
      index,
      id,
      body: {
        doc: document
      }
    });
    logger.info(`Document updated in ${index}: ${id}`);
  } catch (error) {
    logger.error(`Error updating document in ${index}:`, error);
    throw error;
  }
};

// Delete document
export const deleteDocument = async (index: string, id: string) => {
  try {
    await esClient.delete({
      index,
      id
    });
    logger.info(`Document deleted from ${index}: ${id}`);
  } catch (error) {
    logger.error(`Error deleting document from ${index}:`, error);
    throw error;
  }
};

export default esClient;
