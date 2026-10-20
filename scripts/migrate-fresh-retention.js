// Safety first: dry-run default. Back up MongoDB + R2 before --apply.
// Existing post and message media are never immediately deleted by this script.
// The cleanup worker removes expired data in bounded batches after deployment.
require('dotenv').config();
const connectDB=require('../config/db');
const Post=require('../models/Post');
const Message=require('../models/Message');
const {POST_LIFETIME_MS}=require('../services/freshPosts');
const {LIFETIME_MS}=require('../services/freshMessages');

async function main(){
  const apply=process.argv.includes('--apply');
  const includePosts=process.argv.includes('--include-posts');
  const includeMessages=process.argv.includes('--include-messages');
  if(!includePosts&&!includeMessages)throw new Error('Specify --include-posts and/or --include-messages');
  if(apply&&process.env.CONFIRM_FRESH_RETENTION_MIGRATION!=='YES')throw new Error('Set CONFIRM_FRESH_RETENTION_MIGRATION=YES after verified backups.');
  await connectDB();
  const summary={mode:apply?'APPLY':'DRY_RUN'};
  if(includePosts){
    const filter={status:'published',expiresAt:null};
    summary.legacyPublishedPosts=await Post.countDocuments(filter);
    if(apply){
      // Use aggregation pipeline to preserve each post's actual createdAt.
      const result=await Post.updateMany(filter,[{$set:{expiresAt:{$dateAdd:{startDate:'$createdAt',unit:'millisecond',amount:POST_LIFETIME_MS}}}}]);
      summary.updatedPosts=result.modifiedCount;
    }
  }
  if(includeMessages){
    const filter={expiresAt:null};
    summary.legacyMessages=await Message.countDocuments(filter);
    if(apply){
      const result=await Message.updateMany(filter,[{$set:{expiresAt:{$dateAdd:{startDate:'$createdAt',unit:'millisecond',amount:LIFETIME_MS}}}}]);
      summary.updatedMessages=result.modifiedCount;
    }
  }
  console.log(JSON.stringify(summary,null,2));
  if(!apply)console.log('No changes made. Use --apply only after testing the cleanup policy and taking verified backups.');
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>require('mongoose').disconnect().catch(()=>{}));
