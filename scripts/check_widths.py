from osgeo import ogr
ds = ogr.Open(r'C:\Users\leneker\Downloads\shape_urdaneta\POLIGONO_APROBADOS_MAG.shp')
defn = ds.GetLayer(0).GetLayerDefn()
for i in range(defn.GetFieldCount()):
    fld = defn.GetFieldDefn(i)
    if fld.GetName() in ['NOMBRE_PRO', 'NUMERO_PRO', 'NUMERO_IDE']:
        print(fld.GetName(), 'Type:', fld.GetType(), 'Width:', fld.GetWidth())
