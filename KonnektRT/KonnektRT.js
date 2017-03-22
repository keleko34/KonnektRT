define([],function(){
  var fs = require('fs'),
      query = require('querystring'),
      appPath = process.cwd().replace(/\\/g,"/")+"/app",
      base = __dirname.replace(/\\/g,'/')+'/../..',
      path = require('path'),
      streamAppender = require(base+'/Stream_Appender/Build/Stream_Appender')(),
      preappend = streamAppender.preappend,
      append = streamAppender.append;
  
  function CreateKonnektRT()
  {
    /* This is the main routing method */
    function KonnektRT(req,res,next)
    {
      if(req.url.indexOf('/component') === 0)
      {
        /* sort query into single object */
        if(!req.query) req.query = {};
        req.stringQuery = KonnektRT.parseQuery(req.url);
        if(req.url.indexOf('?') !== -1) req.url = req.url.substring(0,req.url.indexOf('?'));
        req.url = req.url.replace('.js','');

        for (var x = 0, keys=Object.keys(req.stringQuery), len = keys.length; x < len; x++)
        {
            req.query[keys[x]] = req.stringQuery[keys[x]];
        }
        
        /* seperate out important queries */
        var _name = req.url.replace('/component/','').replace(/[\/]/g,''),
            _env = req.query.env || 'prod',
            _debug = req.query.debug,
            _edit = req.query.edit,
            _allowed = (req.sessions ? req.sessions.cms : false),
            
            /* end file url */
            _end = translateEnv(_name,_env,_debug),
            
            /* Base component path */
            _base = appPath+'/components/'+_name,
            
            /* Full Path */
            _path = _base + _end,
            
            /* File Stream */
            _file,
            
            _finished = 0,
            _total = 0;
        
        /* Check if file even exists */
        fs.stat(_path,function(err,stat){
          if(!err && stat.isFile())
          {
            /* if env is dev we need to combine css and html into main js file */
            if(_env === 'dev')
            {
              _total += 2;
              _file = fs.createReadStream(_path);

              var _html = "",
                  _css = "",
                  _cms,
                  _err = false;

              if(_edit && _allowed)
              {
                _total += 1;
                
                /* wrap and add cms code */
                attachCMS(_base,_name,function(content){
                  _finished += 1;
                  _cms = content;
                  if(_finished === _total) onFinish(_err,_html,_css,_cms);
                });

              }
              
              function onFinish(err,html,css,cms)
              {
                  if(!err && css && html)
                  {
                      if(cms)
                      {
                        cms = cms.replace(/(\r)/g,'').replace(/(\n)/g,'\r\n\t');

                        _file.pipe(append(
                           '\r\n'+_name+'.prototype.k_cms = (function(){\r\n\t'+cms+'\r\n\treturn '+_name+';\r\n}());'
                          +'\r\n'+_name+'.prototype.k_html = "'+html.replace(/[\r\n]/g,'').replace(/[\"]/g,"'")+'";'
                          +'\r\n'+_name+'.prototype.k_css = "'+css.replace(/[\r\n]/g,'').replace(/[\"]/g,"'")+'";'
                        ))
                        .pipe(preappend('if(!K_Components) K_Components = {};\r\nK_Components["'+_name+'"] = (function(){\r\n\t','\r\n\treturn '+_name+';\r\n}());'))
                        .pipe(res);
                      }
                      else
                      {
                        _file.pipe(append(
                           '\r\n'+_name+'.prototype.k_html = "'+html.replace(/[\r\n]/g,'').replace(/[\"]/g,"'")+'";'
                          +'\r\n'+_name+'.prototype.k_css = "'+css.replace(/[\r\n]/g,'').replace(/[\"]/g,"'")+'";'
                        ))
                        .pipe(preappend('if(!K_Components) K_Components = {};\r\nK_Components["'+_name+'"] = (function(){\r\n\t','\r\n\treturn '+_name+';\r\n}());'))
                        .pipe(res);
                      }
                  }
                  else
                  {
                      _file.pipe(preappend('if(!K_Components) K_Components = {};\r\nK_Components["'+_name+'"] = (function(){\r\n\t','\r\n\treturn '+_name+';\r\n}());'))
                      .pipe(res);
                  }
              }


              /* replace props with file content */
              fs.readFile(_base+'/'+_name+'.html','utf8',function(err,content){
                _finished += 1;
                _err = !!err;
                _html = content;
                if(_finished === _total) onFinish(_err,_html,_css,_cms);
              });
              
              fs.readFile(_base+'/'+_name+'.css','utf8',function(err,content){
                _finished += 1;
                _err = !!err;
                _css = content;
                if(_finished === _total) onFinish(_err,_html,_css,_cms);
              });

            }
            else
            {
              _file = fs.createReadStream(_path);

              var _cms ;

              function onFinish(cms)
              {
                if (cms) {
                    cms = cms.replace(/(\r\n)/g, '\r\n\t');
                    _file.pipe(append('\r\n'+_name+'.prototype.k_cms = (function(){\r\n\t'+cms+'\r\n\treturn '+_name+';\r\n}());'))
                    .pipe(res);
                }
                else
                {
                    _file.pipe(res);
                }
              }

              if(_edit && _allowed)
              {
                _total += 1;

                /* wrap and add cms code */
                attachCMS(_base,_name,function(content){
                  _finished += 1;
                  _cms = content;
                  if (_finished === _total) onFinish(_cms);
                });
              }
              if(_total === 0) onFinish(_cms);
            }
          }
          else if(err && err.code === 'ENOENT')
          {
            if(_env !== 'dev')
            {
              if(res.notFound)
              {
                res.notFound(undefined,'You have not built the component '+_name+' into environment '+_env);
              }
              else
              {
                error(res,404,'You have not built the component '+_name+' into environment '+_env);
              }
            }
            else
            {
              if(res.notFound)
              {
                res.notFound(undefined,'There is no such component by the name '+_name);
              }
              else
              {
                error(res,404,'There is no such component by the name '+_name);
              }
            }
          }
          else
          {
            if(res.serverError) 
            {
              res.serverError();
            }
            else
            {
              error(res,500,"Server error");
            }
          }
        });
        
      }
      else
      {
        next();
      }
    }
    
    KonnektRT.parseQuery = function(url)
    { 
      return query.parse(url.substring((url.indexOf('?')+1),url.length));
    }
    
    function translateEnv(name,env,debug)
    {
      return (env !== 'dev' ? ('/build/' + env + '/' + name + (debug ? '.js' : '.min.js')) : '/'+name+'.js');
    }
    
    function error(res,code,msg)
    {
      res.statusCode = code;
      res.statusMessage = msg;
      res.write(msg,'utf8',function(){
        res.end();
      });
    }
    
    function attachCMS(base,name,cb)
    {
      var _finished = 0;
      
      fs.readFile(base+'/cms/'+name+".js",'utf8',function(err,contentMain){
        if(!err)
        {
          fs.readFile(base+'/cms/'+name+'.html','utf8',function(err,content){
            if(!err)
            {
              contentMain += '\r\n'+name+'.prototype.kcms_html = "'+content.replace(/[\r\n]/g,'')+'";';
              _finished += 1;
              if(_finished === 2) cb(contentMain);
            }
            else
            {
              cb("function "+name+"(){/*There was an error retrieving cms components*/};");
            }
          });
          fs.readFile(base+'/cms/'+name+'.css','utf8',function(err,content){
            if(!err)
            {
              contentMain += '\r\n'+name+'.prototype.kcms_css = "'+content.replace(/[\r\n]/g,'')+'";';
              _finished += 1;
              if(_finished === 2) cb(contentMain);
            }
            else
            {
              cb("function "+name+"(){/*There was an error retrieving cms components*/};");
            }
          });
        }
        else
        {
          cb("function "+name+"(){/*There was an error retrieving cms components*/};");
        }
      })
    }
    
    return KonnektRT;
  }
  return CreateKonnektRT;
});
