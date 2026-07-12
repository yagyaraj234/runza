import 'dotenv/config'
import { Storage } from '@google-cloud/storage'
import { loadConfig } from './config.js'

const config=loadConfig()
if(!config.GCS_BUCKET)throw new Error('GCS_BUCKET is required')
await new Storage().bucket(config.GCS_BUCKET).setMetadata({lifecycle:{rule:[{action:{type:'Delete'},condition:{age:14}}]}})
console.log('Configured 14-day GCS artifact lifecycle')
